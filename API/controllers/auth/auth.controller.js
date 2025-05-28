const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { runWithTransaction } = require('../../db');
const { logAuditEvent } = require('../../routes/utils/audit');

const hashEmail = (email) =>
  crypto.createHash('sha256').update(email.toLowerCase()).digest();

// Register User
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const emailHash = hashEmail(email);

  try {
    const userId = await runWithTransaction(async (query) => {
      const userCheck = await query(
        `SELECT 1 FROM user_username WHERE username = $1 AND valid_to IS NULL`,
        [username]
      );
      if (userCheck.rowCount > 0) {
        throw new Error('Username already taken');
      }

      const emailCheck = await query(
        `SELECT 1 FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
        [emailHash]
      );
      if (emailCheck.rowCount > 0) {
        throw new Error('Email already registered');
      }

      const userRes = await query(
        `INSERT INTO user_identity DEFAULT VALUES RETURNING user_id`
      );
      const userId = userRes.rows[0].user_id;

      await query(
        `INSERT INTO user_username (user_id, username)
         VALUES ($1, $2)`,
        [userId, username]
      );

      await query(
        `INSERT INTO user_email (user_id, email, email_hash)
         VALUES ($1, crypt_user_data('encrypt', 'email', convert_to($2, 'UTF8')), $3)`,
        [userId, email, emailHash]
      );

      const hashedPw = await bcrypt.hash(password, 10);

      await query(
        `INSERT INTO user_password (user_id, password_hash)
         VALUES ($1, crypt_user_data('encrypt', 'password', convert_to($2, 'UTF8')))`,
        [userId, hashedPw]
      );

      await logAuditEvent(query, 'USER_REGISTER_SUCCESS', {
        user_id: userId,
        username,
        email: email.toLowerCase(),
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
      });

      return userId;
    });

    return res.status(201).json({ user_id: userId });
  } catch (e) {
    await runWithTransaction((q) =>
      logAuditEvent(q, 'USER_REGISTER_FAILURE', {
        username,
        email: email?.toLowerCase(),
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        error: e.message,
      })
    ).catch(() => {});

    console.error('Registration error:', e.message);
    return res.status(400).json({ error: e.message });
  }
};

// Login User
const loginUser = async (req, res) => {
  const { username, email, password } = req.body;
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  if ((!username && !email) || !password) {
    return res.status(400).json({ error: 'Username or email and password required' });
  }

  try {
    const { userId, resolvedUsername, sessionId } = await runWithTransaction(async (query) => {
      let userRes;
      if (username) {
        userRes = await query(
          `SELECT user_id FROM user_username WHERE username = $1 AND valid_to IS NULL`,
          [username]
        );
      } else {
        const emailHash = hashEmail(email);
        userRes = await query(
          `SELECT user_id FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
          [emailHash]
        );
      }

      if (userRes.rowCount === 0) {
        throw new Error('User not found');
      }

      const userId = userRes.rows[0].user_id;

      const pwRes = await query(
        `SELECT crypt_user_data('decrypt', 'password', password_hash) AS pw
         FROM user_password WHERE user_id = $1 AND valid_to IS NULL`,
        [userId]
      );
      if (pwRes.rowCount === 0) {
        throw new Error('Password not set');
      }

      // Decrypted password hash is BYTEA; convert to UTF-8 string
      const storedHash = pwRes.rows[0].pw.toString('utf8');

      const isMatch = await bcrypt.compare(password, storedHash);

      const usernameRes = await query(
        `SELECT username FROM user_username WHERE user_id = $1 AND valid_to IS NULL`,
        [userId]
      );
      const resolvedUsername = usernameRes.rows[0]?.username || null;

      await query(
        `INSERT INTO user_login_attempt (user_id, success, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [userId, isMatch, ipAddress, userAgent]
      );

      await logAuditEvent(query, isMatch ? 'USER_LOGIN_SUCCESS' : 'USER_LOGIN_FAILURE', {
        user_id: userId,
        username: resolvedUsername,
        email: email?.toLowerCase(),
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      if (!isMatch) {
        throw new Error('Invalid credentials');
      }

      // Invalidate all other active sessions for single session enforcement
      await query(
        `UPDATE user_session_user
         SET valid_to = now()
         WHERE user_id = $1 AND valid_to IS NULL`,
        [userId]
      );

      const sessionRes = await query(
        `INSERT INTO user_session_identity DEFAULT VALUES RETURNING session_id`
      );
      const sessionId = sessionRes.rows[0].session_id;

      await query(
        `INSERT INTO user_session_user (session_id, user_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, userId, ipAddress, userAgent]
      );

      return { userId, resolvedUsername, sessionId };
    });

    const token = jwt.sign(
      { uid: userId, sid: sessionId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({ user_id: userId, session_id: sessionId, token });
  } catch (e) {
    // Audit login error
    await runWithTransaction((q) =>
      logAuditEvent(q, 'USER_LOGIN_ERROR', {
        username,
        email: email?.toLowerCase(),
        ip_address: ipAddress,
        user_agent: userAgent,
        error: e.message,
      })
    ).catch(() => {});

    console.error('Login error:', e.message);
    return res.status(401).json({ error: e.message || 'Login failed' });
  }
};

// Logout User
const logoutUser = async (req, res) => {
  const authHeader = req.get('Authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const sessionId = payload.sid;

    await runWithTransaction(async (query) => {
      await query(
        `UPDATE user_session_user
         SET valid_to = now()
         WHERE session_id = $1 AND valid_to IS NULL`,
        [sessionId]
      );

      await logAuditEvent(query, 'USER_LOGOUT', {
        user_id: payload.uid,
        session_id: sessionId,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
      });
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (e) {
    console.error('Logout error:', e.message);
    return res.status(400).json({ error: 'Invalid token' });
  }
};

const invalidateOtherSessions = async (req, res) => {
  const { userId } = req.body;
  const currentIp = req.ip;

  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  try {
    await runWithTransaction(async (query) => {
      await query(`
        UPDATE user_session_user
        SET valid_to = now()
        WHERE user_id = $1 AND valid_to IS NULL AND ip_address <> $2
      `, [userId, currentIp]);

      await logAuditEvent(query, 'SESSIONS_INVALIDATED_OTHERS', {
        user_id: userId,
        invalidated_ip_excluded: currentIp,
        ip_address: currentIp,
        user_agent: req.get('User-Agent'),
      });
    });

    return res.status(200).json({ message: 'Other sessions terminated successfully.' });
  } catch (e) {
    console.error('Invalidate other sessions error:', e.message);
    return res.status(500).json({ error: 'Failed to invalidate other sessions' });
  }
};

module.exports = { registerUser, loginUser, savePushToken, logoutUser, invalidateOtherSessions };