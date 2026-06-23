const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

// ─── Get ya create karo direct chat (do users ke beech) ──────────────────────
exports.getOrCreateChat = async (req, res) => {
  try {
    const { userId } = req.body;

    // Apne aap se chat nahi kar sakte
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Apne aap ko message nahi kar sakte.' });
    }

    // Target user exist karta hai?
    const targetUser = await User.findById(userId).select('username fullName avatar isDeleted');
    if (!targetUser || targetUser.isDeleted) {
      return res.status(404).json({ message: 'User nahi mila.' });
    }

    // Pehle se chat exist karti hai?
    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, userId], $size: 2 }
    })
      .populate('participants', 'username fullName avatar')
      .populate('lastMessage');

    // Nahi hai toh create karo
    if (!chat) {
      chat = await Chat.create({
        participants: [req.user._id, userId]
      });
      await chat.populate('participants', 'username fullName avatar');
    }

    res.json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Mere saare chats lao (inbox) ─────────────────────────────────────────────
exports.getMyChats = async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .populate('participants', 'username fullName avatar')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};