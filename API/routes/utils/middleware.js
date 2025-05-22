const jwt = require('jsonwebtoken');
const { pool } = require('../../db');

// Middleware to verify JWT token and active user session
const verifyToken = async (req, res, next) => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing or malformed.' });
    }
    const rawToken = authHeader.slice(7).trim();

    // Verify and decode JWT
    const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
    const { uid, sid } = decoded;

    if (!uid || !sid) {
      return res.status(401).json({ error: 'Invalid token payload.' });
    }

    // Check encryption key presence
    const encryptKey = process.env.PG_ENCRYPT_KEY;
    if (!encryptKey) {
      console.error('PG_ENCRYPT_KEY environment variable is missing.');
      return res.status(500).json({ error: 'Server misconfiguration.' });
    }

    // Acquire client from pool for session-scoped settings
    const client = await pool.connect();
    try {
      // Set encryption key for this transaction/session
      await client.query('SET LOCAL pg.encrypt_key = $1', [encryptKey]);

      // Validate user and session in a single, efficient query
      const { rowCount } = await client.query(`
        SELECT 1
        FROM user_identity u
        JOIN user_session_user su ON u.user_id = su.user_id
        JOIN user_session_identity si ON su.session_id = si.session_id
        WHERE u.user_id = $1
          AND si.session_id = $2
          AND NOT u.is_deleted
          AND NOT si.is_deleted
          AND NOT su.is_deleted
          AND su.valid_from <= now()
          AND (su.valid_to IS NULL OR su.valid_to > now())
        LIMIT 1
      `, [uid, sid]);

      if (rowCount === 0) {
        return res.status(401).json({ error: 'Invalid or expired session.' });
      }

      // Attach authenticated user info to request object
      req.user = { uid, sid };
      next();

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = verifyToken;