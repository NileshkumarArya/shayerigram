const { enqueueNotification } = require('../jobs/queues/notificationQueue');
const mongoose  = require('mongoose');
const Follow    = require('../models/Follow');
const User      = require('../models/User');
const Notification = require('../models/Notification');
const { invalidateCache } = require('../utils/cache');
const logger    = require('../utils/logger');

/**
 * Follow Service — all follow/unfollow business logic
 * Controllers stay thin, services have the logic
 */

const toggleFollow = async (followerId, followingId, io) => {
  if (String(followerId) === String(followingId)) {
    throw Object.assign(new Error('Cannot follow yourself'), { status: 400 });
  }

  const [followerObjId, followingObjId] = [
    new mongoose.Types.ObjectId(followerId),
    new mongoose.Types.ObjectId(followingId),
  ];

  // Check current follow state
  const existing = await Follow.findOne({ followerId: followerObjId, followingId: followingObjId });

  if (existing) {
    // ─── UNFOLLOW ───────────────────────────────────────────────────────────
    await Follow.deleteOne({ _id: existing._id });
    await Promise.all([
      User.findByIdAndUpdate(followerId,  { $inc: { followingCount: -1 } }),
      User.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } }),
    ]);
    await invalidateCache([`user:profile:id:${followerId}`, `user:profile:id:${followingId}`, `feed:first:${followerId}`]);
    logger.info('Unfollowed', { followerId, followingId });
    return { following: false };
  } else {
    // ─── FOLLOW ────────────────────────────────────────────────────────────
    await Follow.create({ followerId: followerObjId, followingId: followingObjId });
    await Promise.all([
      User.findByIdAndUpdate(followerId,  { $inc: { followingCount: 1 } }),
      User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } }),
    ]);

    // ✅ FIX: Use queue instead of direct DB write
    // Socket emit happens inside worker AFTER DB write — correct order
    // ✅ Queue only gets plain serializable data — no io object
    await enqueueNotification({
      recipientId: String(followingObjId),
      actorId:     String(followerObjId),
      type:        'follow',
      entityId:    String(followerObjId),
    });

    // ✅ Lightweight socket emit in request cycle (best-effort, not guaranteed)
    // Worker handles DB write; this just nudges the client to refresh
    if (io) {
      io.to(`notification_${followingId}`).emit('notification', {
        type:    'follow',
        actorId: String(followerObjId),
      });
    }
    await invalidateCache([`user:profile:id:${followerId}`, `user:profile:id:${followingId}`, `feed:first:${followerId}`]);
    logger.info('Followed', { followerId, followingId });
    return { following: true };
  }
};

const getFollowers = async (userId, cursor, limit = 20) => {
  const query = { followingId: userId };
  if (cursor) {
    const { createdAt, _id } = cursor;
    query.$or = [
      { createdAt: { $lt: new Date(createdAt) } },
      { createdAt: new Date(createdAt), _id: { $lt: _id } },
    ];
  }
  const follows = await Follow.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('followerId', '_id username avatar fullName followersCount isVerified');

  const hasMore = follows.length > limit;
  const items   = hasMore ? follows.slice(0, limit) : follows;
  return {
    users:      items.map(f => f.followerId),
    hasMore,
    nextCursor: hasMore ? { createdAt: items[items.length - 1].createdAt, _id: items[items.length - 1]._id } : null,
  };
};

const getFollowing = async (userId, cursor, limit = 20) => {
  const query = { followerId: userId };
  if (cursor) {
    const { createdAt, _id } = cursor;
    query.$or = [
      { createdAt: { $lt: new Date(createdAt) } },
      { createdAt: new Date(createdAt), _id: { $lt: _id } },
    ];
  }
  const follows = await Follow.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('followingId', '_id username avatar fullName followersCount isVerified');

  const hasMore = follows.length > limit;
  const items   = hasMore ? follows.slice(0, limit) : follows;
  return {
    users:      items.map(f => f.followingId),
    hasMore,
    nextCursor: hasMore ? { createdAt: items[items.length - 1].createdAt, _id: items[items.length - 1]._id } : null,
  };
};

const isFollowing = async (followerId, followingId) => {
  return !!(await Follow.exists({ followerId, followingId }));
};

const getFollowingIds = async (userId) => {
  const follows = await Follow.find({ followerId: userId }).select('followingId').lean();
  return follows.map(f => f.followingId);
};

module.exports = { toggleFollow, getFollowers, getFollowing, isFollowing, getFollowingIds };
