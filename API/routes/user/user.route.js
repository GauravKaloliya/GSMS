const express = require('express');
const router = express.Router();
const verifyToken = require('../utils/middleware');
const userController = require('../../controllers/user/user.controller');

router.post('/register', userController.registerUser);

router.use(verifyToken);

router
  .post('/email', userController.addOrUpdateEmail)
  .get('/email', userController.getCurrentEmail)
  .post('/password', userController.setOrUpdatePassword)
  .get('/profile', userController.getProfile)
  .put('/profile', userController.updateProfile);

module.exports = router;