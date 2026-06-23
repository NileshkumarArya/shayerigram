const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getOrCreateChat, getMyChats } = require('../controllers/chatController');

router.use(protect);

router.get('/', getMyChats);        // Inbox — mere saare chats
router.post('/', getOrCreateChat);  // Kisi se chat shuru karo

module.exports = router;
