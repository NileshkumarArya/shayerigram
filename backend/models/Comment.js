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
    // Kept for backward compatibility with existing post comments
    postId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text:       { type: String, required: true, maxlength: 500 },
    parentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }, // null = top-level comment
    likesCount: { type: Number, default: 0 },
    isDeleted:  { type: Boolean, default: false }, // Soft delete

    // Polymorphic fields — used for new targets like Story
    // For posts, targetType/targetId are also populated going forward
    targetType: { type: String, enum: ['Post', 'Story'], default: 'Post' },
    targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

// "All comments for a target" — cursor paginated (Post or Story)
commentSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
// "All comments by a user" — user activity
commentSchema.index({ authorId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1, createdAt: 1 }); // Fetch replies for a comment

// Legacy index kept so existing post-comment queries still work during migration
commentSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
