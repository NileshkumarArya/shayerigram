const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  // Kon kon is chat mein hai
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],

  // Last message ka reference (inbox mein dikhane ke liye)
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },

  lastMessageAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

// Indexes — scalability ke liye zaroori
ChatSchema.index({ participants: 1 });
ChatSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Chat', ChatSchema);