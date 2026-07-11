const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const {
  getSettings, updateSettings, deactivateAccount, deleteAccount, setDateOfBirth,
} = require('../controllers/settingsController');

router.use(protect);

router.get('/',              generalLimiter, getSettings);
router.put('/',              generalLimiter, updateSettings);
router.patch('/date-of-birth', generalLimiter, setDateOfBirth);
router.post('/deactivate',   generalLimiter, deactivateAccount);
router.delete('/account',    generalLimiter, deleteAccount);

module.exports = router;
