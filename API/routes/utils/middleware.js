const jwt = require('jsonwebtoken');
const { pool, setEncryptionKey } = require('../../db');

const verifyToken = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Authorization token missing or malformed.' });

  try {
    const { uid, sid } = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET);
    if (!uid || !sid) throw new Error('Invalid token payload.');

    if (!process.env.PG_ENCRYPT_KEY) {
      console.error('Missing PG_ENCRYPT_KEY');
      return res.status(500).json({ error: 'Server misconfiguration.' });
    }

    const client = await pool.connect();
    try {
      await setEncryptionKey(client);

      const { rowCount } = await client.query(
        `SELECT 1 FROM user_identity u
         JOIN user_session_user su ON u.user_id = su.user_id
         JOIN user_session_identity si ON su.session_id = si.session_id
         WHERE u.user_id = $1 AND si.session_id = $2
           AND NOT u.is_deleted AND NOT si.is_deleted AND NOT su.is_deleted
           AND su.valid_from <= now()
           AND (su.valid_to IS NULL OR su.valid_to > now())
         LIMIT 1`,
        [uid, sid]
      );

      if (!rowCount) return res.status(401).json({ error: 'Invalid or expired session.' });
      req.user = { uid, sid };
      next();
    } finally {
      client.release();
    }
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = verifyToken;