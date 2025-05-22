const { pool, setEncryptionKey } = require('../../db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_TABLES = new Set(['user_email', 'user_password', 'user_profile']);
const hashSHA256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

const runWithClient = async (handler, useTransaction = false) => {
  const client = await pool.connect();
  try {
    await setEncryptionKey(client);
    if (!useTransaction) return await handler(client);

    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    if (useTransaction) await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const expireValidRecord = (client, table, user_id) => {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`);
  return client.query(`UPDATE ${table} SET valid_to = now() WHERE user_id = $1 AND valid_to IS NULL`, [user_id]);
};

const registerUser = async (req, res) => {
  try {
    const { user_id } = await runWithClient(
      client => client.query('INSERT INTO user_identity DEFAULT VALUES RETURNING user_id').then(r => r.rows[0]),
      true
    );
    res.status(201).json({ user_id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'User creation failed' });
  }
};

const addOrUpdateEmail = async (req, res) => {
  const { uid } = req.user, { email } = req.body;
  if (!EMAIL_REGEX.test(email || '')) return res.status(400).json({ error: 'Valid email required' });

  try {
    await runWithClient(async client => {
      await expireValidRecord(client, 'user_email', uid);
      await client.query(
        `INSERT INTO user_email (user_id, email, email_hash, valid_from)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), $3, now())`,
        [uid, email, hashSHA256(email)]
      );
    }, true);
    res.status(201).json({ message: 'Email updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update email' });
  }
};

const getCurrentEmail = async (req, res) => {
  try {
    const email = await runWithClient(async client =>
      client.query(
        `SELECT pgp_sym_decrypt(email, current_setting('pg.encrypt_key')) AS email
         FROM user_email WHERE user_id = $1 AND valid_to IS NULL LIMIT 1`,
        [req.user.uid]
      ).then(r => r.rows[0]?.email)
    );
    email ? res.json({ email }) : res.status(404).json({ error: 'Email not found' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
};

const setOrUpdatePassword = async (req, res) => {
  const { uid } = req.user, { password } = req.body;
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 12);
    await runWithClient(async client => {
      await expireValidRecord(client, 'user_password', uid);
      await client.query(
        `INSERT INTO user_password (user_id, password_hash, valid_from)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), now())`,
        [uid, hash]
      );
    }, true);
    res.status(201).json({ message: 'Password updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

const getProfile = async (req, res) => {
  try {
    const profile = await runWithClient(client =>
      client.query(
        `SELECT first_name, last_name, profile_image, phone_number
         FROM user_profile WHERE user_id = $1 AND valid_to IS NULL LIMIT 1`,
        [req.user.uid]
      ).then(r => r.rows[0])
    );
    profile ? res.json(profile) : res.status(404).json({ error: 'Profile not found' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

const updateProfile = async (req, res) => {
  const { uid } = req.user;
  const { first_name, last_name, profile_image, phone_number } = req.body;

  try {
    await runWithClient(async client => {
      await expireValidRecord(client, 'user_profile', uid);
      await client.query(
        `INSERT INTO user_profile (user_id, first_name, last_name, profile_image, phone_number, valid_from)
         VALUES (
           $1, $2, $3,
           COALESCE($4, (SELECT config_value FROM app_config WHERE config_key = 'default_profile_image_url')),
           $5, now())`,
        [uid, first_name, last_name, profile_image, phone_number]
      );
    }, true);
    res.json({ message: 'Profile updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

module.exports = {
  registerUser,
  addOrUpdateEmail,
  getCurrentEmail,
  setOrUpdatePassword,
  getProfile,
  updateProfile,
};