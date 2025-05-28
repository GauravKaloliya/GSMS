require('dotenv').config();
const { runWithTransaction } = require('../../db');
const { logAuditEvent } = require('../../routes/utils/audit');

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

module.exports = {
  savePushToken,
};