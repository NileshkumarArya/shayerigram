const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  // Kis chat ka message hai
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },

  // Kisne bheja
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Message content
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },

  // Message type — future ke liye (image, voice baad mein)
  type: {
    type: String,
    enum: ['text'],
    default: 'text'
  },

  // Delete ke liye
  isDeleted: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

// Indexes — scalability ke liye
MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });

module.exports = mongoose.model('Message', MessageSchema);