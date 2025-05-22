const { pool, setEncryptionKey } = require('../../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const hashEmail = (email) => {
    // return hex string instead of buffer for consistent query param usage
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  };
  
  const registerUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
  
    const emailHash = hashEmail(email); // hex string
  
    try {
      const userId = await runWithClient(async (client) => {
        // no inline SET pg.encrypt_key here; setEncryptionKey(client) is already called
  
        // Check for existing email hash
        const existing = await client.query(
          `SELECT user_id FROM user_email WHERE email_hash = decode($1, 'hex') AND valid_to IS NULL`,
          [emailHash]
        );
        if (existing.rowCount > 0) {
          throw new Error('Email already registered');
        }
  
        // Insert user_identity and get user_id
        const insertUserRes = await client.query(
          `INSERT INTO user_identity DEFAULT VALUES RETURNING user_id`
        );
        const newUserId = insertUserRes.rows[0].user_id;
  
        // Insert encrypted email (plain string) and email_hash (decoded hex)
        await client.query(
          `INSERT INTO user_email(user_id, email, email_hash)
           VALUES ($1, pgp_sym_encrypt($2, get_encrypt_key()), decode($3, 'hex'))`,
          [newUserId, email, emailHash]
        );
  
        // Hash password and encrypt it
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
  
  const loginUser = async (req, res) => {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');
  
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
  
    const emailHash = hashEmail(email); // hex string
  
    try {
      const userId = await runWithClient(async (client) => {
        // Find user by email_hash (decode hex)
        const userRes = await client.query(
          `SELECT user_id FROM user_email WHERE email_hash = decode($1, 'hex') AND valid_to IS NULL`,
          [emailHash]
        );
  
        if (userRes.rowCount === 0) {
          throw new Error('User not found');
        }
        const userId = userRes.rows[0].user_id;
  
        // Get decrypted password hash
        const passRes = await client.query(
          `SELECT pgp_sym_decrypt(password_hash, get_encrypt_key()) AS password_hash
           FROM user_password WHERE user_id = $1 AND valid_to IS NULL`,
          [userId]
        );
  
        if (passRes.rowCount === 0) {
          throw new Error('Password not set');
        }
  
        const storedHash = passRes.rows[0].password_hash;
  
        const match = await bcrypt.compare(password, storedHash);
  
        // Log login attempt
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