const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const {
  setupTwoFactor, enableTwoFactor, disableTwoFactor, verifyTwoFactorLogin,
} = require('../controllers/twoFactorController');

router.post('/setup',        protect, setupTwoFactor);
router.post('/enable',       protect, enableTwoFactor);
router.post('/disable',      protect, disableTwoFactor);
router.post('/verify-login', loginLimiter, verifyTwoFactorLogin); // not protected — same limiter as login itself

module.exports = router;