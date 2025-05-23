const { pool, setEncryptionKey } = require('../../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Hash email with SHA256 to BYTEA buffer
const hashEmail = (email) => {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest();
};

// Helper: run DB client with encryption key set
const runWithClient = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e; // Important: make sure you’re not swallowing the error here
  } finally {
    client.release();
  }
};


const registerUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const emailHash = hashEmail(email); // Buffer
  const emailBuffer = Buffer.from(email); // for encryption (pgp_sym_encrypt)
  console.log(`Email hash: ${emailHash.toString('hex')}`);
  console.log(`Email buffer: ${emailBuffer.toString('hex')}`);
  try {
    const userId = await runWithClient(async (client) => {
      // Check for existing email currently valid
      const existing = await client.query(
        `SELECT user_id FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
        [emailHash]
      );
      console.log(existing);
      if (existing.rowCount > 0) {
        throw new Error('Email already registered');
      }

      // Insert new user identity, get user_id
      const insertUserRes = await client.query(
        `INSERT INTO user_identity DEFAULT VALUES RETURNING user_id`
      );
      const newUserId = insertUserRes.rows[0].user_id;
      console.log(`New user_id: ${newUserId}`);
      // Insert encrypted email and hash with validity (valid_from defaults now())
      await client.query(
        `INSERT INTO user_email(user_id, email, email_hash)
         VALUES ($1, pgp_sym_encrypt($2, get_encrypt_key()), $3)`,
        [newUserId, emailBuffer, emailHash]
      );

      // Hash password (bcrypt) then encrypt
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log(`Hashed password: ${hashedPassword}`);
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
      // Find user by current email hash
      const userRes = await client.query(
        `SELECT user_id FROM user_email WHERE email_hash = $1 AND valid_to IS NULL`,
        [emailHash]
      );

      if (userRes.rowCount === 0) {
        throw new Error('User not found');
      }
      const userId = userRes.rows[0].user_id;

      // Get decrypted current password hash
      const passRes = await client.query(
        `SELECT pgp_sym_decrypt(password_hash, get_encrypt_key()) AS password_hash
         FROM user_password WHERE user_id = $1 AND valid_to IS NULL`,
        [userId]
      );

      if (passRes.rowCount === 0) {
        throw new Error('Password not set');
      }

      const storedHash = passRes.rows[0].password_hash;

      // Compare bcrypt password
      const match = await bcrypt.compare(password, storedHash);

      // Log login attempt (success or failure)
      await client.query(
        `INSERT INTO user_login_attempt(user_id, success, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [userId, match, ipAddress, userAgent]
      );

      if (!match) {
        throw new Error('Invalid credentials');
      }

      return userId;
    });

    res.status(200).json({ user_id: userId });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(401).json({ error: e.message || 'Login failed' });
  }
};

module.exports = { registerUser, loginUser };