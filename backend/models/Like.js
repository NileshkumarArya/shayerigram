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
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Unique: can't like twice + fast "did user like this post?" check
likeSchema.index({ postId: 1, userId: 1 }, { unique: true });
// "All posts liked by user" — profile/saved likes
likeSchema.index({ userId: 1, createdAt: -1 });
// "All likes for post" — if needed for analytics
likeSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model('Like', likeSchema);
