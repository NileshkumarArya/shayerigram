const mongoose = require('mongoose');

/**
 * Post Model — Scalable Design
 * 
 * REMOVED from Post document (moved to separate collections):
 *   - likes[]    → Like collection
 *   - savedBy[]  → Save collection  
 *   - comments[] → Comment collection
 * 
 * KEPT as denormalized counters for display (updated atomically via $inc):
 *   - likesCount, commentsCount, savesCount
 * 
 * Why this matters at scale:
 *   - Old: Post doc grows with every like/comment → doc bloat → slow reads
 *   - New: Post doc stays small forever → fast reads always
 */
const postSchema = new mongoose.Schema(
  {
    author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:     { type: String, maxlength: 100, default: '' },
    content:   { type: String, required: false, default: '', maxlength: 2000 }, // ✅ optional for image-only posts
    type:      { type: String, enum: ['text', 'image'], default: 'text' },
    image:     { type: String },
    imagePublicId: { type: String },

    // ✅ Multi-select categories (1-3) — enum validated in pre-save
    categories: {
      type: [String],
      default: ['Other'],
    },
    // Keep for backward compat — frontend may still use category
    category: { type: String, default: 'Other' },

    writtenIn: { type: String, enum: ['Hindi', 'Urdu', 'English', 'Mixed'], default: 'Hindi' }, // renamed from 'language' to avoid MongoDB text index conflict
    hashtags:  [{ type: String, lowercase: true }],

    // ✅ Denormalized counters — NEVER compute by scanning arrays
    likesCount:    { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    savesCount:    { type: Number, default: 0, min: 0 },
    views:         { type: Number, default: 0, min: 0 },
    shares:        { type: Number, default: 0, min: 0 },

    isPublic:    { type: Boolean, default: true },
    isReported:  { type: Boolean, default: false },
    reportCount: { type: Number, default: 0, min: 0 },
    isTakenDown: { type: Boolean, default: false },

    // ✅ Soft delete fields (post recoverable by admin for 30 days)
    isDeleted:      { type: Boolean, default: false },
    deletedAt:      { type: Date },
    deletedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletionReason: { type: String, maxlength: 200 },

    // ✅ Theme — store the visual theme used when creating post
    theme:       { type: String, default: 'classic' },
    fontStyle:   { type: String, default: 'shayari' },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
// "Posts by user X sorted by newest" — profile page, feed
postSchema.index({ author: 1, createdAt: -1 });

// "Posts in category X sorted by newest" — explore page
postSchema.index({ categories: 1, createdAt: -1 });

// Global feed sort — cursor pagination anchor
postSchema.index({ createdAt: -1, _id: -1 });

// Trending — sort by likes
postSchema.index({ likesCount: -1, createdAt: -1 });

// Hashtag search
postSchema.index({ hashtags: 1, createdAt: -1 });

// Public posts only filter — common WHERE clause
postSchema.index({ isPublic: 1, createdAt: -1 });
postSchema.index({ isDeleted: 1, createdAt: -1 }); // Soft delete filter

// ✅ NO text index — avoids "language override unsupported" error
// MongoDB text index conflicts with our 'language' field name
// Search uses regex which is fast enough for <100k posts
// If you need text search at scale, use Elasticsearch or Atlas Search

// ─── Auto-extract hashtags ─────────────────────────────────────────────────
postSchema.pre('save', function (next) {
  // Validate categories
  const VALID_CATS = ['Love', 'Sad', 'Motivational', 'Funny', 'Spiritual', 'Nature', 'Life', 'Friendship', 'Patriotic', 'Other'];
  if (this.isModified('categories')) {
    this.categories = (this.categories || [])
      .filter(c => VALID_CATS.includes(c))
      .slice(0, 3);
    if (this.categories.length === 0) this.categories = ['Other'];
  }

  if (this.isModified('content') && this.content) {
    const tags = this.content.match(/#[a-zA-Z0-9_\u0900-\u097F\u0600-\u06FF]+/g);
    this.hashtags = tags
      ? [...new Set(tags.map(t => t.slice(1).toLowerCase()))].slice(0, 10)
      : [];
  }
  // Sync category (singular) with first of categories array — backward compat
  if (this.isModified('categories') && this.categories?.length > 0) {
    this.category = this.categories[0];
  }
  next();
});

// ✅ Auto-filter deleted posts from ALL find queries
// Use Post.findWithDeleted() to include deleted posts (admin use)
postSchema.pre(/^find/, function (next) {
  if (this.getOptions()._includeDeleted) return next();
  this.where({ isDeleted: { $ne: true } });
  next();
});

const PostModel = mongoose.model('Post', postSchema);

// Helper for admin queries that need deleted posts
PostModel.findWithDeleted = (filter = {}) =>
  PostModel.find(filter).setOptions({ _includeDeleted: true });

module.exports = PostModel;
