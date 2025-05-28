const express = require('express');
const router = express.Router();
const { registerUser, savePushToken, loginUser, logoutUser } = require('../../controllers/auth/auth.controller');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/push-token', savePushToken);
router.post('/logout', logoutUser);

module.exports = router;
