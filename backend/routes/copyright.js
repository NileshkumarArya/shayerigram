const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { mongoIdValidation } = require('../middleware/validate');
const { getMyStrikes, disputeStrike } = require('../controllers/copyrightController');

router.use(protect);
router.get('/my',              getMyStrikes);
router.patch('/:id/dispute',   ...mongoIdValidation('id'), disputeStrike);

module.exports = router;