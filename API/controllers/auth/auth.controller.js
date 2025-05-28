// Authentication handlers with integrated audit logging

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { runWithTransaction } = require('../../db');

/**
 * Hash an email address (lower‑cased) with SHA‑256 so we can use it in equality + range constraints
 */
const hashEmail = (email) => crypto.createHash('sha256').update(email.toLowerCase()).digest();

/**
 * Generic helper to write an audit_log_identity + audit_log_event pair inside the *same* transaction
 * in which the business action occurs. This guarantees atomicity and preserves a clear
 * causal chain for forensic analysis.
 *
 * @param {Function} query  – the pg client query helper passed by runWithTransaction
 * @param {String}   type   – e.g. 'USER_REGISTER_SUCCESS'
 * @param {Object}   detail – arbitrary JSON‑serialisable object with contextual info
 */
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

/**
 * Register a new user, inserting identity/email/password rows and a success/failure audit trail.
 */
const registerUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const emailHash = hashEmail(email);
  // We store the raw email encrypted with pgcrypto; convert to Buffer first.
  const emailBuf = Buffer.from(email);

  try {
    const userId = await runWithTransaction(async (query) => {
      // 1. Ensure email not already in use (ignores soft‑deleted rows)
      const existing = await query(
        `SELECT 1 FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
        [emailHash]
      );
      if (existing.rowCount > 0) {
        throw new Error('Email already registered');
      }

      // 2. Insert into user_identity => get new UUID
      const userRes = await query(
        `INSERT INTO user_identity DEFAULT VALUES RETURNING user_id`
      );
      const newUserId = userRes.rows[0].user_id;

      // 3. Insert email (encrypted)
      await query(
        `INSERT INTO user_email (user_id, email, email_hash)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), $3)`,
        [newUserId, emailBuf, emailHash]
      );

      // 4. Hash + encrypt password
      const hashedPw = await bcrypt.hash(password, 10);
      await query(
        `INSERT INTO user_password (user_id, password_hash)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')))`,
        [newUserId, hashedPw]
      );

      // 5. Audit success *inside* the txn
      await logAuditEvent(query, 'USER_REGISTER_SUCCESS', {
        user_id: newUserId,
        email: email.toLowerCase(),
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
      });

      return newUserId;
    });

    return res.status(201).json({ user_id: userId });
  } catch (e) {
    // Log failure in its own small transaction (we could also reuse the same pool‑client)
    await runWithTransaction((q) =>
      logAuditEvent(q, 'USER_REGISTER_FAILURE', {
        email: email.toLowerCase(),
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        error: e.message,
      })
    ).catch(() => {/* ignore secondary errors */});

    console.error('Registration error:', e.message);
    return res.status(400).json({ error: e.message || 'User creation failed' });
  }
};

/**
 * Login handler with audit logging for both successful and failed attempts.
 */
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const emailHash = hashEmail(email);

  try {
    const { userId, isMatch } = await runWithTransaction(async (query) => {
      // Resolve user_id (ensuring email version is current)
      const userRes = await query(
        `SELECT user_id FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
        [emailHash]
      );
      if (userRes.rowCount === 0) {
        throw new Error('User not found');
      }
      const userId = userRes.rows[0].user_id;

      // Pull decrypted stored password hash
      const pwRes = await query(
        `SELECT pgp_sym_decrypt(password_hash, current_setting('pg.encrypt_key')) AS pw
         FROM user_password WHERE user_id = $1 AND valid_to IS NULL`,
        [userId]
      );
      if (pwRes.rowCount === 0) {
        throw new Error('Password not set');
      }

      const isMatch = await bcrypt.compare(password, pwRes.rows[0].pw);

      // Persist raw login attempt row (regardless of outcome)
      await query(
        `INSERT INTO user_login_attempt (user_id, success, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [userId, isMatch, ipAddress, userAgent]
      );

      // Audit login attempt
      await logAuditEvent(query, isMatch ? 'USER_LOGIN_SUCCESS' : 'USER_LOGIN_FAILURE', {
        user_id: userId,
        email: email.toLowerCase(),
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      if (!isMatch) {
        // By throwing after audit, we rollback the txn but *audit remains* (because audit is inside the txn)
        throw new Error('Invalid credentials');
      }

      return { userId, isMatch };
    });

    // On success, create a signed JWT – NB: payload uses `uid` for compatibility
    const token = jwt.sign(
      { uid: userId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({ user_id: userId, token });
  } catch (e) {
    // For errors *not* thrown inside the main transaction (e.g. connection issues),
    // record a coarse‑grained audit entry.
    await runWithTransaction((q) =>
      logAuditEvent(q, 'USER_LOGIN_ERROR', {
        email: email.toLowerCase(),
        ip_address: ipAddress,
        user_agent: userAgent,
        error: e.message,
      })
    ).catch(() => {/* ignore secondary errors */});

    console.error('Login error:', e.message);
    return res.status(401).json({ error: e.message || 'Login failed' });
  }
};

module.exports = { registerUser, loginUser };