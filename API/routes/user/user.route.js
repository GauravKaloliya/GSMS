const express = require('express');
const router = express.Router();
const verifyToken = require('../utils/middleware');

const userController = require('../../controllers/user/user.controller');

// -- USER IDENTITY ROUTES --
router.post('/register', userController.registerUser);

// -- USER EMAIL ROUTES --
router.post('/email', verifyToken, userController.addOrUpdateEmail);
router.get('/email', verifyToken, userController.getCurrentEmail);

// -- USER PASSWORD ROUTES --
router.post('/password', verifyToken, userController.setOrUpdatePassword);

// -- USER PROFILE ROUTES --
router.get('/profile', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, userController.updateProfile);

module.exports = router;