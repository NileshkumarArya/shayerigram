const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMessages, deleteMessage } = require('../controllers/messageController');

router.use(protect);

router.get('/:chatId', getMessages);           // Ek chat ke messages lao
router.delete('/:messageId', deleteMessage);   // Message delete karo

module.exports = router;
