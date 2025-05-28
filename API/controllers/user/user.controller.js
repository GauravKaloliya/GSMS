require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { runWithClient } = require('../../db');
const { logAuditEvent } = require('../../routes/utils/audit');

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
const ALLOWED_TABLES = new Set(['user_email', 'user_password', 'user_profile']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper: SHA256 hash email (hex)
const hashSHA256 = (text) =>
  crypto.createHash('sha256').update(text.toLowerCase()).digest('hex');

// Helper: expire old valid records for a user in a specific table
const expireValidRecord = async (client, table, user_id) => {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table name: ${table}`);
  return client.query(
    `UPDATE ${table} SET valid_to = NOW() WHERE user_id = $1 AND valid_to IS NULL`,
    [user_id]
  );
};

// Save Push Token
const savePushToken = async (req, res) => {
  const { uid } = req.user;
  const { push_token, platform } = req.body;

  if (!push_token || !platform) {
    return res.status(400).json({ error: 'Push token and platform are required' });
  }

  try {
    await runWithTransaction(async (query) => {
      await query(
        `INSERT INTO user_push_token (user_id, push_token, platform)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, push_token) WHERE NOT is_deleted
         DO UPDATE SET platform = EXCLUDED.platform, updated_at = now()`,
        [uid, push_token, platform]
      );

      await logAuditEvent(query, 'PUSH_TOKEN_SAVED', {
        user_id: uid,
        push_token,
        platform,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
      });
    });

    return res.status(200).json({ message: 'Push token saved successfully' });
  } catch (e) {
    console.error('Save push token error:', e.message);
    return res.status(500).json({ error: 'Failed to save push token' });
  }
};

// Add or update user email (soft-expire old emails)
const addOrUpdateEmail = async (req, res) => {
  const { uid } = req.user;
  const { email } = req.body;

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const normalizedEmail = email.toLowerCase();
  const emailHash = hashSHA256(normalizedEmail);

  try {
    await runWithClient(async (client) => {
      await expireValidRecord(client, 'user_email', uid);

      await client.query(
        `INSERT INTO user_email (user_id, email, email_hash, valid_from)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), $3, NOW())`,
        [uid, normalizedEmail, emailHash]
      );
    }, true);

    return res.status(201).json({ message: 'Email updated' });
  } catch (error) {
    console.error('Email update error:', error);
    return res.status(500).json({ error: 'Failed to update email' });
  }
};

// Get current active email for user
const getCurrentEmail = async (req, res) => {
  const { uid } = req.user;

  try {
    const email = await runWithClient(async (client) => {
      const result = await client.query(
        `SELECT pgp_sym_decrypt(email, current_setting('pg.encrypt_key')) AS email
         FROM user_email WHERE user_id = $1 AND valid_to IS NULL LIMIT 1`,
        [uid]
      );
      return result.rows[0]?.email || null;
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    return res.json({ email });
  } catch (error) {
    console.error('Get email error:', error);
    return res.status(500).json({ error: 'Failed to fetch email' });
  }
};

// Set or update password (soft-expire old passwords)
const setOrUpdatePassword = async (req, res) => {
  const { uid } = req.user;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    await runWithClient(async (client) => {
      await expireValidRecord(client, 'user_password', uid);

      await client.query(
        `INSERT INTO user_password (user_id, password_hash, valid_from)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('pg.encrypt_key')), NOW())`,
        [uid, hashedPassword]
      );
    }, true);

    return res.status(201).json({ message: 'Password updated' });
  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  const { uid } = req.user;

  try {
    const profile = await runWithClient(async (client) => {
      const result = await client.query(
        `SELECT first_name, last_name, profile_image, phone_number
         FROM user_profile WHERE user_id = $1 AND valid_to IS NULL LIMIT 1`,
        [uid]
      );
      return result.rows[0] || null;
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Update user profile (soft-expire old profile data)
const updateProfile = async (req, res) => {
  const { uid } = req.user;
  const { first_name, last_name, profile_image, phone_number } = req.body;

  try {
    await runWithClient(async (client) => {
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

    return res.json({ message: 'Profile updated' });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

module.exports = {
  savePushToken,
  addOrUpdateEmail,
  getCurrentEmail,
  setOrUpdatePassword,
  getProfile,
  updateProfile,
};