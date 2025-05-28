const express = require('express');
const router = express.Router();
const { savePushToken, addOrUpdateEmail, getCurrentEmail, setOrUpdatePassword, getProfile, updateProfile } = require('../../controllers/user/user.controller');

router
  .post('/push-token', savePushToken)
  .post('/email', addOrUpdateEmail)
  .get('/email', getCurrentEmail)
  .post('/password', setOrUpdatePassword)
  .get('/profile', getProfile)
  .put('/profile', updateProfile);

module.exports = router;