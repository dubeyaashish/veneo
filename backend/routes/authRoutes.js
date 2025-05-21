const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/telegram', authController.authenticateTelegram);
router.post('/complete-registration', authController.completeRegistration);
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

module.exports = router;
