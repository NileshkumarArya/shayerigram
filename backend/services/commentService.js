const { enqueueNotification } = require('../jobs/queues/notificationQueue');
/**
 * Comment Service — uses separate Comment collection
 * No embedded arrays in Post document
 */
const Comment      = require('../models/Comment');
const Post         = require('../models/Post');
const Block        = require('../models/Block');
const Notification = require('../models/Notification');
const { buildCursorPagination, encodeCursor } = require('../utils/pagination');
const logger = require('../utils/logger');

// ✅ FIX: Accept parentId as explicit parameter — req was never in scope here
const addComment = async (postId, authorId, text, actorUsername, io, parentId = null) => {
  const post = await Post.findOne({
    _id: postId,
    isDeleted: { $ne: true },
    isTakenDown: { $ne: true },
  }).select('author commentsCount');

  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

  if (String(post.author) !== String(authorId)) {
    const blocked = await Block.exists({
      $or: [
        { blockerId: authorId, blockeeId: post.author },
        { blockerId: post.author, blockeeId: authorId },
      ],
    });

    if (blocked) throw Object.assign(new Error('Post not found'), { status: 404 });
  }

  // Create in Comment collection
  const comment = await Comment.create({ postId, authorId, text, parentId: parentId || null });
  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

  // Populate author for response
  const populated = await comment.populate('authorId', '_id username avatar');

  // Notification (not yourself)
  if (String(post.author) !== String(authorId)) {
    // ✅ Queue notification
    enqueueNotification({
      recipientId: post.author,
      actorId:     authorId,
      type:        'comment',
      entityId:    postId,
    }).catch(() => {});
    if (io) io.to(`notification_${post.author}`).emit('notification', {
      type: 'comment', actorUsername, postId,
    });
  }

  // Backward compat: return shape frontend expects
  return {
    comment: {
      _id:       comment._id,
      text:      comment.text,
      user:      populated.authorId,
      createdAt: comment.createdAt,
    },
    commentsCount: (post.commentsCount || 0) + 1,
  };
};

const deleteComment = async (commentId, userId, postId) => {
  const comment = await Comment.findOne({ _id: commentId, postId });
  if (!comment) throw Object.assign(new Error('Comment not found'), { status: 404 });

  // Only comment author or post author can delete
  const post = await Post.findById(postId).select('author');
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

  const isOwner = String(comment.authorId) === String(userId);
  const isPostOwner = String(post.author) === String(userId);

  if (!isOwner && !isPostOwner)
    throw Object.assign(new Error('Not authorized'), { status: 403 });

  await Comment.deleteOne({ _id: commentId, postId });
  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -1 } });

  return { message: 'Comment deleted' };
};

const getComments = async (postId, query = {}) => {
  const { filter: cursorFilter, sort, limit } = buildCursorPagination(query);

  const comments = await Comment
    .find({ postId, ...cursorFilter })
    .sort(sort)
    .limit(limit + 1)
    .populate('authorId', '_id username avatar isVerified')
    .lean();

  const hasMore = comments.length > limit;
  const items   = hasMore ? comments.slice(0, limit) : comments;

  // Map to frontend-compatible shape (user instead of authorId)
  const mapped = items.map(c => ({
    _id:       c._id,
    text:      c.text,
    user:      c.authorId,
    createdAt: c.createdAt,
  }));

  return {
    comments: mapped,
    hasMore,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
  };
};

module.exports = { addComment, deleteComment, getComments };
