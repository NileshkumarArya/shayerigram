const mongoose = require('mongoose');

/**
 * Like Collection — Separate from Post
 * Instead of Post.likes[] (grows unbounded)
 * 
 * Scales to: millions of likes
 * Counters: Post.likesCount (atomic $inc)
 * 
 * At 100k posts, avg 50 likes each = 5M documents — easily indexed
 */
const likeSchema = new mongoose.Schema(
  {
    // Kept for backward compatibility with existing post likes
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Polymorphic fields — used for new targets like Story
    // For posts, targetType/targetId are also populated going forward
    targetType: { type: String, enum: ['Post', 'Story'], default: 'Post' },
    targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

// Unique: can't like the same target twice + fast "did user like this?" check
likeSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });
// "All targets liked by user" — profile/saved likes
likeSchema.index({ userId: 1, createdAt: -1 });
// "All likes for a target" — analytics
likeSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

// Legacy index kept so existing post-like queries still work during migration
likeSchema.index({ postId: 1, userId: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('Like', likeSchema);
