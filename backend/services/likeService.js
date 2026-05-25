const { enqueueNotification } = require('../jobs/queues/notificationQueue');
const Like  = require('../models/Like');
const Post  = require('../models/Post');
const Block = require('../models/Block');
const { invalidateCache } = require('../utils/cache');

const toggleLike = async (userId, postId, actorUsername, io) => {
  const targetPost = await Post.findOne({
    _id: postId,
    isDeleted:   { $ne: true },
    isTakenDown: { $ne: true },
  }).select('_id author likesCount');

  if (!targetPost) {
    throw Object.assign(new Error('Post not found'), { status: 404 });
  }

  if (String(targetPost.author) !== String(userId)) {
    const blocked = await Block.exists({
      $or: [
        { blockerId: userId,             blockeeId: targetPost.author },
        { blockerId: targetPost.author,  blockeeId: userId },
      ],
    });
    if (blocked) {
      throw Object.assign(new Error('Post not found'), { status: 404 });
    }
  }

  const existing = await Like.findOne({ userId, postId });

  if (existing) {
    await Like.deleteOne({ _id: existing._id });
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: -1 } },
      { new: true }
    ).select('likesCount');
    await invalidateCache([`post:${postId}`, 'trending:posts']);
    return { liked: false, likesCount: updatedPost?.likesCount || 0 };
  }

  await Like.create({ userId, postId });
  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    { $inc: { likesCount: 1 } },
    { new: true }
  ).select('author likesCount');
  await invalidateCache([`post:${postId}`, 'trending:posts']);

  if (updatedPost && String(updatedPost.author) !== String(userId)) {
    enqueueNotification({
      recipientId: updatedPost.author,
      actorId:     userId,
      type:        'like',
      entityId:    postId,
    }).catch(() => {});
    if (io) {
      io.to(`notification_${updatedPost.author}`).emit('notification', {
        type:   'like',
        postId,
      });
    }
  }

  return { liked: true, likesCount: updatedPost?.likesCount };
};

const isLiked = async (userId, postId) => {
  return !!(await Like.exists({ userId, postId }));
};

const getUserLikedPostIds = async (userId, postIds) => {
  const likes = await Like.find({ userId, postId: { $in: postIds } }).select('postId').lean();
  return new Set(likes.map(l => String(l.postId)));
};

module.exports = { toggleLike, isLiked, getUserLikedPostIds };