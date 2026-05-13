const express = require('express');
const router  = express.Router();
const {
  getNotifications, getUnreadCount, markRead, markOneRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { mongoIdValidation } = require('../middleware/validate');

router.get('/',              protect, getNotifications);
router.get('/unread-count',  protect, getUnreadCount);
router.put('/mark-read',     protect, markRead);
router.put('/:id/read', protect, ...mongoIdValidation('id'), markOneRead);

module.exports = router;
