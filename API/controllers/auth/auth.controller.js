const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { runWithTransaction } = require('../../db');

// Hash email for range lookups
const hashEmail = (email) =>
  crypto.createHash('sha256').update(email.toLowerCase()).digest();

const logAuditEvent = async (query, type, detail) => {
  const idRes = await query(
    `INSERT INTO audit_log_identity DEFAULT VALUES RETURNING log_id`
  );
  const logId = idRes.rows[0].log_id;
  await query(
    `INSERT INTO audit_log_event (log_id, event_time, event_type, event_details)
     VALUES ($1, now(), $2, $3::jsonb)`,
    [logId, type, JSON.stringify(detail)]
  );
  return logId;
};

// Register
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const emailHash = hashEmail(email);
  const emailBuf = Buffer.from(email);

  try {
    const userId = await runWithTransaction(async (query) => {
      // 1. Ensure username is unique (ignoring expired versions)
      const userCheck = await query(
        `SELECT 1 FROM user_username WHERE username = $1 AND valid_to IS NULL`,
        [username]
      );
      if (userCheck.rowCount > 0) {
        throw new Error('Username already taken');
      }

      // 2. Ensure email is not reused
      const emailCheck = await query(
        `SELECT 1 FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
        [emailHash]
      );
      if (emailCheck.rowCount > 0) {
        throw new Error('Email already registered');
      }

      // 3. Create user_id
      const userRes = await query(
        `INSERT INTO user_identity DEFAULT VALUES RETURNING user_id`
      );
      const userId = userRes.rows[0].user_id;

      // 4. Insert username
      await query(
        `INSERT INTO user_username (user_id, username)
         VALUES ($1, $2)`,
        [userId, username]
      );

      // 5. Insert email (encrypted)
      await query(
        `INSERT INTO user_email (user_id, email, email_hash)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), $3)`,
        [userId, emailBuf, emailHash]
      );

      // 6. Insert password (hashed + encrypted)
      const hashedPw = await bcrypt.hash(password, 10);
      await query(
        `INSERT INTO user_password (user_id, password_hash)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')))`,
        [userId, hashedPw]
      );

      // 7. Audit
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

// Login
const loginUser = async (req, res) => {
  const { username, email, password } = req.body;
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  if ((!username && !email) || !password) {
    return res.status(400).json({ error: 'Username or email and password required' });
  }

  try {
    const { userId, resolvedUsername, isMatch } = await runWithTransaction(async (query) => {
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
        `SELECT pgp_sym_decrypt(password_hash, current_setting('pg.encrypt_key')) AS pw
         FROM user_password WHERE user_id = $1 AND valid_to IS NULL`,
        [userId]
      );
      if (pwRes.rowCount === 0) {
        throw new Error('Password not set');
      }

      console.log(password, pwRes.rows[0].pw);

      const isMatch = await bcrypt.compare(password, pwRes.rows[0].pw);

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

      return { userId, resolvedUsername, isMatch };
    });

    const token = jwt.sign(
      { uid: userId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({ user_id: userId, username: resolvedUsername, token });
  } catch (e) {
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

module.exports = { registerUser, loginUser };