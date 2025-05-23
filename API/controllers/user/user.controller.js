require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { runWithClient } = require('../../db');

// Config
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
const ALLOWED_TABLES = new Set(['user_email', 'user_password', 'user_profile']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Utils
const hashSHA256 = (text) => crypto.createHash('sha256').update(text.toLowerCase()).digest('hex');

const expireValidRecord = (client, table, user_id) => {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`);
  return client.query(
    `UPDATE ${table} SET valid_to = NOW() WHERE user_id = $1 AND valid_to IS NULL`,
    [user_id]
  );
};

// Handlers
const addOrUpdateEmail = async (req, res) => {
  const { uid } = req.user;
  const { email } = req.body;

  if (!EMAIL_REGEX.test(email || '')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const normalizedEmail = email.toLowerCase();
  const emailHash = hashSHA256(normalizedEmail);

  try {
    await runWithClient(async client => {
      await expireValidRecord(client, 'user_email', uid);
      await client.query(
        `INSERT INTO user_email (user_id, email, email_hash, valid_from)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), $3, NOW())`,
        [uid, normalizedEmail, emailHash]
      );
    }, true);

    res.status(201).json({ message: 'Email updated' });
  } catch (e) {
    console.error('Email update error:', e);
    res.status(500).json({ error: 'Failed to update email' });
  }
};

const getCurrentEmail = async (req, res) => {
  try {
    const email = await runWithClient(async client => {
      const result = await client.query(
        `SELECT pgp_sym_decrypt(email, current_setting('pg.encrypt_key')) AS email
         FROM user_email WHERE user_id = $1 AND valid_to IS NULL LIMIT 1`,
        [req.user.uid]
      );
      return result.rows[0]?.email;
    });

    email
      ? res.json({ email })
      : res.status(404).json({ error: 'Email not found' });
  } catch (e) {
    console.error('Get email error:', e);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
};

const setOrUpdatePassword = async (req, res) => {
  const { uid } = req.user;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    await runWithClient(async client => {
      await expireValidRecord(client, 'user_password', uid);
      await client.query(
        `INSERT INTO user_password (user_id, password_hash, valid_from)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), NOW())`,
        [uid, hashedPassword]
      );
    }, true);

    res.status(201).json({ message: 'Password updated' });
  } catch (e) {
    console.error('Password update error:', e);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

const getProfile = async (req, res) => {
  const { uid } = req.user;
  try {
    
    const profile = await runWithClient(async client => {
      const result = await client.query(
        `SELECT first_name, last_name, profile_image, phone_number
         FROM user_profile WHERE user_id = $1 AND valid_to IS NULL`,
        [uid]
      );
      return result.rows[0];
    });

    profile
      ? res.json(profile)
      : res.status(404).json({ error: 'Profile not found' });
  } catch (e) {
    console.error('Get profile error:', e);
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
        `INSERT INTO user_profile (
           user_id, first_name, last_name, profile_image, phone_number, valid_from
         ) VALUES (
           $1, $2, $3,
           COALESCE($4, (SELECT config_value FROM app_config WHERE config_key = 'default_profile_image_url')),
           $5, NOW())`,
        [uid, first_name, last_name, profile_image, phone_number]
      );
    }, true);

    res.json({ message: 'Profile updated' });
  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

module.exports = {
  addOrUpdateEmail,
  getCurrentEmail,
  setOrUpdatePassword,
  getProfile,
  updateProfile,
};