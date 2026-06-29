const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema(
  {
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      default: '',
      maxlength: 50000, // 50k characters per chapter
    },
    chapterNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },

    // Audio support
    audioUrl:      { type: String, default: null },
    audioPublicId: { type: String, default: null },
    audioDuration: { type: Number, default: null }, // seconds mein

    // Content type
    contentType: {
      type: String,
      enum: ['text', 'audio', 'text_audio'],
      default: 'text',
    },

    // Reading stats
    totalReads: { type: Number, default: 0, min: 0 },

    // Premium chapter
    isPremium: { type: Boolean, default: false },

    // Estimated reading time (minutes)
    readingTime: { type: Number, default: 1 },

    // Soft delete
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto calculate reading time before save
ChapterSchema.pre('save', function (next) {
  if (this.content) {
    const wordsPerMinute = 200;
    const wordCount = this.content.trim().split(/\s+/).length;
    this.readingTime = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  }
  next();
});

// Indexes
ChapterSchema.index({ story: 1, chapterNumber: 1 }, { unique: true });
ChapterSchema.index({ story: 1, status: 1 });
ChapterSchema.index({ author: 1 });

module.exports = mongoose.model('Chapter', ChapterSchema);