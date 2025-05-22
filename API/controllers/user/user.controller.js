const express = require('express');
const router = express.Router();
const { pool, setEncryptionKey } = require('../../db');
const verifyToken = require('../utils/middleware');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();

// SHA256 hash helper
const hashSHA256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// Helper to expire current valid record in a table for a user
async function expireCurrentValidRecord(client, table, user_id) {
  const query = `UPDATE ${table} SET valid_to = now() WHERE user_id = $1 AND valid_to IS NULL`;
  await client.query(query, [user_id]);
}

// Helper to set encryption key for current client connection
async function prepareClient(client) {
  await setEncryptionKey(client);
}

// -- USER IDENTITY ROUTES --

// Create a new user identity record
router.post('/register', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Optionally: generate some initial user data here
    const { rows } = await client.query('INSERT INTO user_identity DEFAULT VALUES RETURNING user_id');
    await client.query('COMMIT');
    res.status(201).json({ user_id: rows[0].user_id });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Register error:', err);
    res.status(500).json({ error: 'User creation failed' });
  } finally {
    if (client) client.release();
  }
});

// -- USER EMAIL ROUTES --

// Add or update user's email
router.post('/email', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // TODO: Validate email format (e.g. with validator.js)

  const emailHash = hashSHA256(email);
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await prepareClient(client);

    await expireCurrentValidRecord(client, 'user_email', uid);

    const insertEmailQuery = `
      INSERT INTO user_email (user_id, email, email_hash, valid_from)
      VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), $3, now())
    `;
    await client.query(insertEmailQuery, [uid, email, emailHash]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Email updated' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Email update error:', err);
    res.status(500).json({ error: 'Failed to update email' });
  } finally {
    if (client) client.release();
  }
});

// Retrieve user's current valid email (decrypted)
router.get('/email', verifyToken, async (req, res) => {
  const { uid } = req.user;
  let client;
  try {
    client = await pool.connect();
    await prepareClient(client);

    const selectEmailQuery = `
      SELECT pgp_sym_decrypt(email, current_setting('pg.encrypt_key')) AS email
      FROM user_email
      WHERE user_id = $1 AND valid_to IS NULL
    `;
    const { rows } = await client.query(selectEmailQuery, [uid]);

    if (!rows.length) return res.status(404).json({ error: 'Email not found' });
    res.json({ email: rows[0].email });
  } catch (err) {
    console.error('Fetch email error:', err);
    res.status(500).json({ error: 'Failed to fetch email' });
  } finally {
    if (client) client.release();
  }
});

// -- USER PASSWORD ROUTES --

// Add or update user's password
router.post('/password', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required' });

  // TODO: Validate password strength (e.g. length, complexity)

  let client;
  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    client = await pool.connect();
    await client.query('BEGIN');
    await prepareClient(client);

    await expireCurrentValidRecord(client, 'user_password', uid);

    const insertPasswordQuery = `
      INSERT INTO user_password (user_id, password_hash, valid_from)
      VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), now())
    `;
    await client.query(insertPasswordQuery, [uid, passwordHash]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Password updated' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Password update error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  } finally {
    if (client) client.release();
  }
});

// -- USER PROFILE ROUTES --

// Get user's current valid profile
router.get('/profile', verifyToken, async (req, res) => {
  const { uid } = req.user;
  try {
    const selectProfileQuery = `
      SELECT first_name, last_name, profile_image, phone_number
      FROM user_profile
      WHERE user_id = $1 AND valid_to IS NULL
    `;
    const { rows } = await pool.query(selectProfileQuery, [uid]);

    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user's profile
router.put('/profile', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { first_name, last_name, profile_image, phone_number } = req.body;
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    await expireCurrentValidRecord(client, 'user_profile', uid);

    const insertProfileQuery = `
      INSERT INTO user_profile (user_id, first_name, last_name, profile_image, phone_number, valid_from)
      VALUES (
        $1,
        $2,
        $3,
        COALESCE($4, (SELECT config_value FROM app_config WHERE config_key = 'default_profile_image_url')),
        $5,
        now()
      )
    `;
    await client.query(insertProfileQuery, [uid, first_name, last_name, profile_image, phone_number]);

    await client.query('COMMIT');
    res.json({ message: 'Profile updated' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;