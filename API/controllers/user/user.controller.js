const express = require('express');
const router = express.Router();
const { pool, setEncryptionKey } = require('../../db');
const verifyToken = require('../../routes/utils/middleware');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();

// SHA256 hash helper
const hashSHA256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// Allowed tables for expireCurrentValidRecord
const allowedTables = new Set([
  'user_email',
  'user_password',
  'user_profile',
]);

// Helper to expire current valid record in a table for a user
async function expireCurrentValidRecord(client, table, user_id) {
  if (!allowedTables.has(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  const query = `UPDATE ${table} SET valid_to = now() WHERE user_id = $1 AND valid_to IS NULL`;
  await client.query(query, [user_id]);
}

// Helper to set encryption key for current client connection
async function prepareClient(client) {
  await setEncryptionKey(client);
}

// Basic email format validation placeholder
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// -- USER IDENTITY ROUTES --

router.post('/register', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows } = await client.query(
      'INSERT INTO user_identity DEFAULT VALUES RETURNING user_id'
    );

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

router.post('/email', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });

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

router.post('/password', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { password } = req.body;

  if (!password) return res.status(400).json({ error: 'Password is required' });

  // TODO: Validate password strength (e.g., length, complexity)

  let client;

  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
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

router.get('/profile', verifyToken, async (req, res) => {
  const { uid } = req.user;
  let client;

  try {
    client = await pool.connect();
    await prepareClient(client);

    const selectProfileQuery = `
      SELECT first_name, last_name, profile_image, phone_number
      FROM user_profile
      WHERE user_id = $1 AND valid_to IS NULL
    `;

    const { rows } = await client.query(selectProfileQuery, [uid]);

    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  } finally {
    if (client) client.release();
  }
});

router.put('/profile', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { first_name, last_name, profile_image, phone_number } = req.body;
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await prepareClient(client);

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

    await client.query(insertProfileQuery, [
      uid,
      first_name,
      last_name,
      profile_image,
      phone_number,
    ]);

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