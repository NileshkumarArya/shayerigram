const { enqueueNotification } = require('../jobs/queues/notificationQueue');
const Like  = require('../models/Like');
const Post  = require('../models/Post');
const Block = require('../models/Block');
const { invalidateCache } = require('../utils/cache');

// toggleLike now stays post-only (unchanged behavior) but writes the
// polymorphic fields too so it matches the current Like schema.
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
        { blockerId: userId,            blockeeId: targetPost.author },
        { blockerId: targetPost.author, blockeeId: userId },
      ],
    });
    if (blocked) throw Object.assign(new Error('Post not found'), { status: 404 });
  }

  // Race-condition safe removal, matched by polymorphic target
  const removed = await Like.deleteOne({ userId, targetType: 'Post', targetId: postId });

  if (removed.deletedCount > 0) {
    const updatedPost = await Post.findOneAndUpdate(
      { _id: postId, likesCount: { $gt: 0 } },
      { $inc: { likesCount: -1 } },
      { new: true }
    ).select('likesCount');
    await invalidateCache([`post:${postId}`, 'trending:posts']);
    return { liked: false, likesCount: Math.max(updatedPost?.likesCount || 0, 0) };
  }

  // FIX: targetType/targetId now included — required by the schema
  try {
    await Like.create({ userId, postId, targetType: 'Post', targetId: postId });
  } catch (err) {
    if (err.code === 11000) {
      const currentPost = await Post.findById(postId).select('likesCount');
      return { liked: true, likesCount: currentPost?.likesCount || 0 };
    }
    throw err;
  }

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

  return { liked: true, likesCount: updatedPost?.likesCount || 0 };
};

const isLiked = async (userId, postId) => {
  return !!(await Like.exists({ userId, targetType: 'Post', targetId: postId }));
};

const getUserLikedPostIds = async (userId, postIds) => {
  const likes = await Like.find({ userId, targetType: 'Post', targetId: { $in: postIds } })
    .select('targetId')
    .lean();
  return new Set(likes.map(l => String(l.targetId)));
};

module.exports = { toggleLike, isLiked, getUserLikedPostIds };