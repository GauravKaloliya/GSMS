const jwt = require('jsonwebtoken');
const { runWithTransaction } = require('../../db');

const verifyToken = async (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing or malformed.' });
  }

  const token = authHeader.slice(7).trim();

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  const { uid, sid } = payload || {};
  if (!uid || !sid) {
    return res.status(401).json({ error: 'Invalid token payload.' });
  }

  try {
    const sessionValid = await runWithTransaction(async (query) => {
      const { rowCount } = await query(
        `
        SELECT 1
        FROM user_identity u
        JOIN user_session_user su ON u.user_id = su.user_id
        JOIN user_session_identity si ON su.session_id = si.session_id
        WHERE u.user_id = $1
          AND si.session_id = $2
          AND NOT u.is_deleted
          AND NOT su.is_deleted
          AND NOT si.is_deleted
          AND su.valid_from <= NOW()
          AND (su.valid_to IS NULL OR su.valid_to > NOW())
        LIMIT 1
        `,
        [uid, sid]
      );
      return rowCount > 0;
    });

    if (!sessionValid) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    req.user = { uid, sid };
    next();
  } catch (err) {
    console.error('Session validation error:', err.message);
    return res.status(500).json({ error: 'Internal server error during session validation.' });
  }
};

module.exports = verifyToken;