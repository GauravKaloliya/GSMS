const { pool, setEncryptionKey } = require('../../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * Hash email to a fixed-length binary buffer using SHA-256.
 * This is used for indexing and quick lookups.
 * @param {string} email
 * @returns {Buffer}
 */
const hashEmail = (email) => {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest();
};

/**
 * Runs a handler function with a DB client that has the encryption key set.
 * @param {(client: import('pg').PoolClient) => Promise<any>} handler
 */
const runWithClient = async (handler) => {
  const client = await pool.connect();
  try {
    await setEncryptionKey(client);
    return await handler(client);
  } finally {
    client.release();
  }
};

/**
 * Registers a new user: creates identity, stores encrypted email & hashed password.
 */
const registerUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
  
    const emailHash = hashEmail(email);
  
    try {
      const userId = await runWithClient(async (client) => {
        const existing = await client.query(
          `SELECT user_id FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
          [emailHash]
        );
        if (existing.rowCount > 0) {
          throw new Error('Email already registered');
        }
  
        const insertUserRes = await client.query(
          `INSERT INTO user_identity DEFAULT VALUES RETURNING user_id`
        );
        const newUserId = insertUserRes.rows[0].user_id;
  
        // Pass email as Buffer directly
        const emailBuffer = Buffer.from(email.toLowerCase());
  
        await client.query(
          `INSERT INTO user_email(user_id, email, email_hash)
           VALUES ($1, pgp_sym_encrypt($2, get_encrypt_key()), $3)`,
          [newUserId, emailBuffer, emailHash]
        );
  
        const hashedPassword = await bcrypt.hash(password, 10);
  
        await client.query(
          `INSERT INTO user_password(user_id, password_hash)
           VALUES ($1, pgp_sym_encrypt($2, get_encrypt_key()))`,
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

/**
 * Logs in a user by verifying password and logging the attempt.
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
    const userId = await runWithClient(async (client) => {
      // Find user by hashed email (only valid emails)
      const userRes = await client.query(
        `SELECT user_id FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
        [emailHash]
      );

      if (userRes.rowCount === 0) throw new Error('User not found');
      const userId = userRes.rows[0].user_id;

      // Decrypt stored password hash
      const passRes = await client.query(
        `SELECT pgp_sym_decrypt(password_hash, get_encrypt_key()) AS password_hash
         FROM user_password WHERE user_id = $1 AND valid_to IS NULL`,
        [userId]
      );

      if (passRes.rowCount === 0) throw new Error('Password not set');

      const storedHash = passRes.rows[0].password_hash;

      // Compare supplied password with stored bcrypt hash
      const match = await bcrypt.compare(password, storedHash);

      // Log this login attempt
      await client.query(
        `INSERT INTO user_login_attempt (user_id, success, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [userId, match, ipAddress, userAgent]
      );

      if (!match) throw new Error('Invalid credentials');

      return userId;
    });

    res.status(200).json({ user_id: userId });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(401).json({ error: e.message || 'Login failed' });
  }
};

module.exports = { registerUser, loginUser };