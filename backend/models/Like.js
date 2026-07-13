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
   targetType: { type: String, enum: ['Post', 'Story', 'Comment', 'Chapter'], default: 'Post' },
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

// Removed: { postId: 1, userId: 1 } sparse unique index — every non-Post
// like (Story/Chapter/Comment) defaults postId to null, and a sparse index
// still counts explicit nulls as present, so it falsely treated any two
// different non-Post likes from the same user as duplicates. The
// { targetType, targetId, userId } index below already provides the real
// uniqueness guarantee for all target types, including Post.
module.exports = mongoose.model('Like', likeSchema);
