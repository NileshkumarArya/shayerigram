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

    // Cover image support
    coverImage:         { type: String, default: '' },
    coverImagePublicId: { type: String, default: '' },

    // Content type
    contentType: {
      type: String,
      enum: ['text', 'audio', 'text_audio'],
      default: 'text',
    },

    // Mature content tag — chapter-level, not story-level (a story can mix
    // normal and mature chapters, per design). Enforced in
    // chapterController.getChapter(); doesn't itself hide the chapter from
    // the chapter list (list still shows it, just badged).
    isMature: { type: Boolean, default: false },

    // Reading stats
    totalReads: { type: Number, default: 0, min: 0 },

    // ✅ NEW — lets the writer see which chapter readers liked the most
    totalLikes: { type: Number, default: 0, min: 0 },

    // Premium chapter
    isPremium: { type: Boolean, default: false },

    isReported:  { type: Boolean, default: false },
    reportCount: { type: Number, default: 0, min: 0 },

    // Estimated reading time (minutes)
    readingTime: { type: Number, default: 1 },

    // Soft delete / admin takedown
    isDeleted:      { type: Boolean, default: false },
    deletedAt:      { type: Date },
    deletedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletionReason: { type: String, default: '' },
    isTakenDown:    { type: Boolean, default: false },
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
// ✅ FIX: removed duplicate `ChapterSchema.index({ author: 1 })` — the
// `author` field above already has `index: true`, which was causing the
// "Duplicate schema index" warning on server boot.

// ✅ Auto-filter deleted chapters from ALL find queries (same pattern as Post.js/Story.js)
// Use Chapter.findWithDeleted() to include deleted chapters (admin use)
ChapterSchema.pre(/^find/, function (next) {
  if (this.getOptions()._includeDeleted) return next();
  this.where({ isDeleted: { $ne: true }, isTakenDown: { $ne: true } });
  next();
});

const ChapterModel = mongoose.model('Chapter', ChapterSchema);

// Helper for admin queries that need deleted chapters
ChapterModel.findWithDeleted = (filter = {}) =>
  ChapterModel.find(filter).setOptions({ _includeDeleted: true });

module.exports = ChapterModel;