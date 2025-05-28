require('dotenv').config();
const { Expo } = require('expo-server-sdk');
const { runWithTransaction } = require('../../db');
const { logAuditEvent } = require('../../routes/utils/audit');

const expo = new Expo();

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

const sendNotification = async (userId, notificationPayload) => {
  try {
    let tokens = [];

    await runWithTransaction(async (query) => {
      const result = await query(
        `SELECT push_token, platform FROM user_push_token
         WHERE user_id = $1 AND NOT is_deleted`,
        [userId]
      );
      tokens = result.rows;
    });

    if (tokens.length === 0) {
      console.log(`No push tokens found for user ${userId}`);
      return;
    }

    const validTokens = tokens.filter(t => Expo.isExpoPushToken(t.push_token));

    if (validTokens.length === 0) {
      console.log(`No valid Expo push tokens for user ${userId}`);
      return;
    }

    const messages = validTokens.map(({ push_token, platform }) => ({
      to: push_token,
      sound: 'default',
      title: notificationPayload.title,
      body: notificationPayload.body,
      data: notificationPayload.data || {},
      ...(platform === 'android' && { priority: 'high' }), // example customization
    }));

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        console.log('Push receipts:', receipts);

        for (const receipt of receipts) {
          if (receipt.status === 'error') {
            console.error(`Expo error for token ${receipt.details?.expoPushToken}:`, receipt.message);

            if (receipt.details?.error === 'DeviceNotRegistered') {
              await runWithTransaction(async (query) => {
                await query(
                  `UPDATE user_push_token SET is_deleted = true, updated_at = now()
                   WHERE push_token = $1`,
                  [receipt.details.expoPushToken]
                );
                await logAuditEvent(query, 'PUSH_TOKEN_REMOVED', {
                  user_id: userId,
                  push_token: receipt.details.expoPushToken,
                  reason: 'DeviceNotRegistered',
                });
              });
            }
          }
        }
      } catch (error) {
        console.error('Error sending chunk of notifications:', error);
      }
    }

    // Optional: Log the notification send event
    await runWithTransaction(async (query) => {
      await logAuditEvent(query, 'PUSH_NOTIFICATION_SENT', {
        user_id: userId,
        payload: notificationPayload,
        sent_to_tokens: validTokens.map(t => t.push_token),
      });
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

const sendNotificationHandler = async (req, res) => {
    const { user_id, title, body, data } = req.body;
  
    if (!user_id || !title || !body) {
      return res.status(400).json({ error: 'user_id, title, and body are required' });
    }
  
    try {
      await sendNotification(user_id, {
        title,
        body,
        data: data || {},
      });
  
      return res.status(200).json({ message: 'Notification sent successfully' });
    } catch (error) {
      console.error('sendNotificationHandler error:', error.message);
      return res.status(500).json({ error: 'Failed to send notification' });
    }
  };

module.exports = {
  savePushToken,
  sendNotification,
  sendNotificationHandler
};