const express = require('express');
const router  = express.Router();
const {
  register, login, getMe, logout,
  verifyEmail, resendVerification,
  forgotPassword, resetPassword,
} = require('../controllers/authController');
const {
  protect,
  refreshAccessToken,
  revokeCurrentDevice,
  revokeAllDevices,
} = require('../middleware/auth');
const {
  registerValidation, loginValidation,
  forgotPasswordValidation, resetPasswordValidation,
} = require('../middleware/validate');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { verifyTurnstile } = require('../middleware/turnstileVerify');
const { checkIpAbuse } = require('../middleware/abuseDetection');

router.post('/register',
  registerLimiter,
  checkIpAbuse('register', 5, 3600),
  verifyTurnstile,
  registerValidation,
  register
);
router.post('/login',
  loginLimiter,
  checkIpAbuse('login', 10, 900),
  loginValidation,
  login
);
router.get ('/me',                   protect,               getMe);
router.post('/logout',                                      revokeCurrentDevice); // No protect — expired token must still clear cookies
router.post('/logout-all',           protect,               revokeAllDevices);
router.post('/refresh',                                     refreshAccessToken);
router.get ('/verify-email',                                verifyEmail);
router.post('/resend-verification',                         resendVerification);
router.post('/forgot-password',      loginLimiter, checkIpAbuse('forgot', 3, 3600), forgotPasswordValidation, forgotPassword);
router.post('/reset-password',       resetPasswordValidation,  resetPassword);

module.exports = router;
