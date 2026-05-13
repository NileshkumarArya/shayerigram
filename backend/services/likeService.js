const { enqueueNotification } = require('../jobs/queues/notificationQueue');
const Like      = require('../models/Like');
const Post      = require('../models/Post');
const Notification = require('../models/Notification');
const { invalidateCache } = require('../utils/cache');
const logger    = require('../utils/logger');

const toggleLike = async (userId, postId, actorUsername, io) => {
  const existing = await Like.findOne({ userId, postId });

  if (existing) {
    await Like.deleteOne({ _id: existing._id });
    await Post.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } });
    await invalidateCache([`post:${postId}`, 'trending:posts']);
    return { liked: false };
  } else {
    await Like.create({ userId, postId });
    const post = await Post.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } }, { new: true }).select('author likesCount');
    await invalidateCache([`post:${postId}`, 'trending:posts']);

    // Notification (don't notify yourself)
    if (post && String(post.author) !== String(userId)) {
      // ✅ Queue notification — non-blocking
      enqueueNotification({
        recipientId: post.author,
        actorId:     userId,
        type:        'like',
        entityId:    postId,
      }).catch(() => {});
      if (io) io.to(`notification_${post.author}`).emit('notification', { type: 'like', postId });
    }
    return { liked: true, likesCount: post?.likesCount };
  }
};

const isLiked = async (userId, postId) => {
  return !!(await Like.exists({ userId, postId }));
};

const getUserLikedPostIds = async (userId, postIds) => {
  const likes = await Like.find({ userId, postId: { $in: postIds } }).select('postId').lean();
  return new Set(likes.map(l => String(l.postId)));
};

module.exports = { toggleLike, isLiked, getUserLikedPostIds };
