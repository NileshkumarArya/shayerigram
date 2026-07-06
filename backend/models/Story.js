const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema(
  {
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
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    coverImage:        { type: String, default: null },
    coverImagePublicId:{ type: String, default: null },
    genre: {
      type: String,
      enum: [
        'Love', 'Sad', 'Horror', 'Motivation',
        'Comedy', 'Thriller', 'Fantasy', 'Poetry',
        'Spiritual', 'Biography', 'Other'
      ],
      default: 'Other',
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags) => tags.length <= 10,
        message: 'Maximum 10 tags allowed',
      },
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'unpublished'],
      default: 'draft',
      index: true,
    },
    language: {
      type: String,
      enum: ['hindi', 'urdu', 'english', 'hinglish'],
      default: 'hindi',
    },

    // Counters — denormalized for performance
    totalChapters:  { type: Number, default: 0, min: 0 },
    totalReads:     { type: Number, default: 0, min: 0 },
    totalLikes:     { type: Number, default: 0, min: 0 },
    totalComments:  { type: Number, default: 0, min: 0 },
    totalBookmarks: { type: Number, default: 0, min: 0 },

    // Content type
    contentType: {
      type: String,
      enum: ['text', 'audio', 'text_audio'],
      default: 'text',
    },

    isPremium:  { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },

    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for scalability
StorySchema.index({ author: 1, status: 1 });
StorySchema.index({ genre: 1, status: 1 });
StorySchema.index({ tags: 1 });
StorySchema.index({ totalReads: -1 });
StorySchema.index({ totalLikes: -1 });
StorySchema.index({ createdAt: -1 });
StorySchema.index({ status: 1, createdAt: -1 });
// ✅ NO text index — 'language' field (hindi/urdu/hinglish) breaks MongoDB's
// text-index language stemmer ("language override unsupported: hindi").
// Story search uses regex (searchService.js), so this index isn't needed anyway.

// ✅ Auto-filter deleted stories from ALL find queries (same pattern as Post.js)
// Use Story.findWithDeleted() to include deleted stories (admin use)
StorySchema.pre(/^find/, function (next) {
  if (this.getOptions()._includeDeleted) return next();
  this.where({ isDeleted: { $ne: true } });
  next();
});

const StoryModel = mongoose.model('Story', StorySchema);

// Helper for admin queries that need deleted stories
StoryModel.findWithDeleted = (filter = {}) =>
  StoryModel.find(filter).setOptions({ _includeDeleted: true });

module.exports = StoryModel;