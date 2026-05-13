const mongoose = require('mongoose');

/**
 * Save Collection — Separate from User/Post
 * Instead of User.savedPosts[] + Post.savedBy[]
 * 
 * Counters: User.savedCount + Post.savesCount
 */
const saveSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

saveSchema.index({ userId: 1, postId: 1 }, { unique: true });
saveSchema.index({ userId: 1, createdAt: -1 });   // Saved posts page (cursor paginable)
saveSchema.index({ postId: 1, createdAt: -1 });   // Who saved a post (admin/analytics)

module.exports = mongoose.model('Save', saveSchema);
