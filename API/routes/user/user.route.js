const express = require('express');
const router = express.Router();
const { savePushToken, sendNotificationHandler } = require('../../controllers/user/user.controller');

router
  .post('/push-token', savePushToken)
  .post('/send-notification', sendNotificationHandler);

module.exports = router;