const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { runWithTransaction } = require('../../db');

const hashEmail = (email) => {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest();
};

const registerUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const emailHash = hashEmail(email);
  const emailBuffer = Buffer.from(email);

  try {
    const userId = await runWithTransaction(async (query) => {
      const existing = await query(
        `SELECT user_id FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
        [emailHash]
      );
      if (existing.rowCount > 0) {
        throw new Error('Email already registered');
      }

      const insertUserRes = await query(
        `INSERT INTO user_identity DEFAULT VALUES RETURNING user_id`
      );
      const newUserId = insertUserRes.rows[0].user_id;
      
      await query(
        `INSERT INTO user_email(user_id, email, email_hash)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), $3)`,
        [newUserId, emailBuffer, emailHash]
      );

      const hashedPassword = await bcrypt.hash(password, 10);
      
      await query(
        `INSERT INTO user_password(user_id, password_hash)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')))`,
        [newUserId, hashedPassword]
      );

      return newUserId;
    });

    res.status(201).json({ user_id: userId });
  } catch (e) {
    console.error('Registration error:', e.message);
    res.status(400).json({ error: e.message || 'User creation failed' });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const emailHash = hashEmail(email);

  try {
    const userId = await runWithTransaction(async (query) => {
      const userRes = await query(
        `SELECT user_id FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
        [emailHash]
      );

      if (userRes.rowCount === 0) {
        throw new Error('User not found');
      }

      const userId = userRes.rows[0].user_id;

      const passRes = await query(
        `SELECT pgp_sym_decrypt(password_hash, current_setting('pg.encrypt_key')) AS password_hash
         FROM user_password WHERE user_id = $1 AND valid_to IS NULL`,
        [userId]
      );

      if (passRes.rowCount === 0) {
        throw new Error('Password not set');
      }

      const storedHash = passRes.rows[0].password_hash;
      const match = await bcrypt.compare(password, storedHash);

      await query(
        `INSERT INTO user_login_attempt(user_id, success, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [userId, match, ipAddress, userAgent]
      );

      if (!match) {
        throw new Error('Invalid credentials');
      }

      return userId;
    });

    const token = jwt.sign(
      { user_id: userId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ user_id: userId, token });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(401).json({ error: e.message || 'Login failed' });
  }
};

module.exports = { registerUser, loginUser };