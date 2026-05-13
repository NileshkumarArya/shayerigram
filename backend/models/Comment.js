const mongoose = require('mongoose');

/**
 * Comment Collection — Separate from Post
 * Instead of Post.comments[] embedded array (causes doc bloat at scale)
 * 
 * Counters: Post.commentsCount (atomic $inc)
 * 
 * Benefits:
 * - Post document stays small regardless of comment count
 * - Comments queryable independently
 * - Easy cursor pagination for comments
 */
const commentSchema = new mongoose.Schema(
  {
    postId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text:       { type: String, required: true, maxlength: 500 },
    parentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }, // null = top-level comment
    likesCount: { type: Number, default: 0 },
    isDeleted:  { type: Boolean, default: false }, // Soft delete
  },
  { timestamps: true }
);

// "All comments for a post" — cursor paginated
commentSchema.index({ postId: 1, createdAt: -1 });
// "All comments by a user" — user activity
commentSchema.index({ authorId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1, createdAt: 1 }); // Fetch replies for a comment

module.exports = mongoose.model('Comment', commentSchema);
