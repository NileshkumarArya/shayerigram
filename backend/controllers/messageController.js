const Message = require('../models/Message');
const Chat = require('../models/Chat');

// ─── Messages fetch karo ek chat ke liye ──────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 50; // Ek baar mein 50 messages

    // Verify karo ki user is chat ka participant hai
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });
    if (!chat) {
      return res.status(404).json({ message: 'Chat nahi mili.' });
    }

    const messages = await Message.find({
      chatId,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('sender', 'username fullName avatar');

    res.json({
      success: true,
      messages: messages.reverse(), // Purane pehle
      hasMore: messages.length === limit
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Message delete karo (sirf apna) ─────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOne({
      _id: messageId,
      sender: req.user._id
    });
    if (!message) {
      return res.status(404).json({ message: 'Message nahi mila.' });
    }

    message.isDeleted = true;
    await message.save();

    res.json({ success: true, message: 'Message delete ho gaya.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
