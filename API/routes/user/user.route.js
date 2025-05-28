const express = require('express');
const router = express.Router();
const { savePushToken } = require('./user.controller');

router
  .post('/push-token', savePushToken);

module.exports = router;