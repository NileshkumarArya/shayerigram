const mongoose = require('mongoose');

const ReadingProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
    },
    lastChapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      default: null,
    },
    lastChapterNumber: {
      type: Number,
      default: 1,
    },
    // Scroll position (0-100 percent)
    scrollPosition: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Ek user ek story ki ek hi progress rakhega
ReadingProgressSchema.index({ user: 1, story: 1 }, { unique: true });
ReadingProgressSchema.index({ user: 1, lastReadAt: -1 });

module.exports = mongoose.model('ReadingProgress', ReadingProgressSchema);