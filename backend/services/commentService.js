const { enqueueNotification } = require('../jobs/queues/notificationQueue');
/**
 * Comment Service — uses separate Comment collection
 * No embedded arrays in Post document
 */
const Comment = require('../models/Comment');
const Post    = require('../models/Post');
const Block   = require('../models/Block');
const Like    = require('../models/Like');
const { buildCursorPagination, encodeCursor } = require('../utils/pagination');
const logger  = require('../utils/logger');

const addComment = async (postId, authorId, text, actorUsername, io, parentId = null) => {
  const post = await Post.findOne({
    _id: postId,
    isDeleted:   { $ne: true },
    isTakenDown: { $ne: true },
  }).select('author commentsCount');

  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

  if (String(post.author) !== String(authorId)) {
    const blocked = await Block.exists({
      $or: [
        { blockerId: authorId,   blockeeId: post.author },
        { blockerId: post.author, blockeeId: authorId },
      ],
    });
    if (blocked) throw Object.assign(new Error('Post not found'), { status: 404 });
  }

  // targetType/targetId included — required by the polymorphic schema
  const comment = await Comment.create({
    postId, authorId, text, parentId: parentId || null,
    targetType: 'Post', targetId: postId,
  });
  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

  const populated = await comment.populate('authorId', '_id username avatar');

  if (String(post.author) !== String(authorId)) {
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

  const post = await Post.findOne({
    _id: postId,
    isDeleted: { $ne: true },
  }).select('author');
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

  const isOwner     = String(comment.authorId) === String(userId);
  const isPostOwner = String(post.author)       === String(userId);

  if (!isOwner && !isPostOwner) {
    throw Object.assign(new Error('Not authorized'), { status: 403 });
  }

  // ✅ FIX: atomic delete — agar already deleted hai to counter decrement nahi hoga
  const deleted = await Comment.findOneAndDelete({ _id: commentId, postId });
  if (!deleted) {
    throw Object.assign(new Error('Comment not found'), { status: 404 });
  }

  await Post.findOneAndUpdate(
    { _id: postId, commentsCount: { $gt: 0 } },
    { $inc: { commentsCount: -1 } }
  );

  return { message: 'Comment deleted' };
};

const getComments = async (postId, query = {}, userId = null) => {
  const { filter: cursorFilter, sort, limit } = buildCursorPagination(query);

  const post = await Post.findOne({
    _id: postId,
    isDeleted:   { $ne: true },
    isTakenDown: { $ne: true },
  }).select('author').lean();
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

  let blockedUserIds = [];
  if (userId) {
    const blocks = await Block.find({
      $or: [{ blockerId: userId }, { blockeeId: userId }],
    }).select('blockerId blockeeId').lean();
    blockedUserIds = blocks.map(b =>
      String(b.blockerId) === String(userId) ? b.blockeeId : b.blockerId
    );
    if (
      String(post.author) !== String(userId) &&
      blockedUserIds.some(id => String(id) === String(post.author))
    ) {
      throw Object.assign(new Error('Post not found'), { status: 404 });
    }
  }

  const comments = await Comment
    .find({
      postId,
      ...(blockedUserIds.length ? { authorId: { $nin: blockedUserIds } } : {}),
      ...cursorFilter,
    })
    .sort(sort)
    .limit(limit + 1)
    .populate({
      path: 'authorId',
      select: '_id username avatar isVerified',
      match: { isDeleted: { $ne: true }, isSuspended: { $ne: true } },
    })
    .lean();

  const hasMore = comments.length > limit;
  const items   = hasMore ? comments.slice(0, limit) : comments;
  const visibleItems = items.filter(c => c.authorId);

  // Batch-check which of these comments the current viewer has liked
  let likedCommentIds = new Set();
  if (userId && visibleItems.length > 0) {
    const likes = await Like.find({
      userId, targetType: 'Comment', targetId: { $in: visibleItems.map(c => c._id) },
    }).select('targetId').lean();
    likedCommentIds = new Set(likes.map(l => String(l.targetId)));
  }

  const mapped = visibleItems.map(c => ({
    _id:        c._id,
    text:       c.text,
    user:       c.authorId,
    createdAt:  c.createdAt,
    likesCount: c.likesCount || 0,
    liked:      likedCommentIds.has(String(c._id)),
  }));

  return {
    comments: mapped,
    hasMore,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
  };
};

const toggleCommentLike = async (commentId, userId) => {
  const comment = await Comment.findOne({ _id: commentId, isDeleted: { $ne: true } });
  if (!comment) throw Object.assign(new Error('Comment not found'), { status: 404 });

  const removed = await Like.deleteOne({ userId, targetType: 'Comment', targetId: commentId });

  if (removed.deletedCount > 0) {
    const updated = await Comment.findOneAndUpdate(
      { _id: commentId, likesCount: { $gt: 0 } },
      { $inc: { likesCount: -1 } },
      { new: true }
    ).select('likesCount');
    return { liked: false, likesCount: Math.max(updated?.likesCount || 0, 0) };
  }

  try {
    await Like.create({ userId, targetType: 'Comment', targetId: commentId });
  } catch (err) {
    if (err.code === 11000) {
      const current = await Comment.findById(commentId).select('likesCount');
      return { liked: true, likesCount: current?.likesCount || 0 };
    }
    throw err;
  }

  const updated = await Comment.findByIdAndUpdate(
    commentId,
    { $inc: { likesCount: 1 } },
    { new: true }
  ).select('likesCount');

  return { liked: true, likesCount: updated?.likesCount || 0 };
};

module.exports = { addComment, deleteComment, getComments, toggleCommentLike };