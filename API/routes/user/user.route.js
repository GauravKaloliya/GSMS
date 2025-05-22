const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user/user.controller');

router
  .post('/email', userController.addOrUpdateEmail)
  .get('/email', userController.getCurrentEmail)
  .post('/password', userController.setOrUpdatePassword)
  .get('/profile', userController.getProfile)
  .put('/profile', userController.updateProfile);

module.exports = router;