const express = require('express');
const router  = express.Router();
const { blockUser, unblockUser, getBlockedUsers, getBlockStatus } = require('../controllers/blockController');
const { protect } = require('../middleware/auth');

router.get ('/',          protect, getBlockedUsers);
router.post('/:id',       protect, blockUser);
router.delete('/:id',     protect, unblockUser);
router.get ('/:id/status', protect, getBlockStatus);

module.exports = router;
