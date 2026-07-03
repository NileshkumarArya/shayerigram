const express = require('express');
const router  = express.Router();
const { getMyAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/me', getMyAnalytics);

module.exports = router;