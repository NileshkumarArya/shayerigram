const Post  = require('../models/Post');
const Story = require('../models/Story');
const Notification = require('../models/Notification');
const { buildCursorPagination, encodeCursor } = require('../utils/pagination');
const { deleteCache } = require('../utils/cache');
const logger = require('../utils/logger');

const POST_NOTIFICATION_TYPES = new Set(['like', 'comment', 'reply', 'mention', 'save']);

// @GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);

    const notifications = await Notification.find({
      recipientId: req.user._id,
      ...cursorFilter,
    })
           .sort(sort)
      .limit(limit + 1)
      .populate({
        path: 'actorId',
        select: '_id username avatar',
        match: { isDeleted: { $ne: true }, isSuspended: { $ne: true } },
      })
      .lean();
    const hasMore = notifications.length > limit;
    const items   = hasMore ? notifications.slice(0, limit) : notifications;

    const postIds = items
      .filter(n => POST_NOTIFICATION_TYPES.has(n.type) && n.entityId && n.entityType !== 'Story')
      .map(n => n.entityId);

    const storyIds = items
      .filter(n => POST_NOTIFICATION_TYPES.has(n.type) && n.entityId && n.entityType === 'Story')
      .map(n => n.entityId);

    const [posts, stories] = await Promise.all([
      postIds.length
        ? Post.find({ _id: { $in: postIds }, isDeleted: { $ne: true }, isTakenDown: { $ne: true } })
            .select('_id type image content')
            .lean()
        : [],
      storyIds.length
        ? Story.find({ _id: { $in: storyIds }, isDeleted: false })
            .select('_id title coverImage')
            .lean()
        : [],
    ]);

    const postMap  = new Map(posts.map(p => [String(p._id), p]));
    const storyMap = new Map(stories.map(s => [String(s._id), s]));

    const MODERATION_TYPES = new Set(['takedown', 'copyright_strike', 'admin_alert']);

    const normalized = items.map(n => ({
      ...n,
      actorId: MODERATION_TYPES.has(n.type) ? null : n.actorId,
      sender:  MODERATION_TYPES.has(n.type) ? null : (n.actorId || null),
      actor:   MODERATION_TYPES.has(n.type) ? null : (n.actorId || null),
      read:    n.isRead,
      post:   POST_NOTIFICATION_TYPES.has(n.type) && n.entityId && n.entityType !== 'Story'
        ? postMap.get(String(n.entityId)) || null
        : null,
      story:  POST_NOTIFICATION_TYPES.has(n.type) && n.entityId && n.entityType === 'Story'
        ? storyMap.get(String(n.entityId)) || null
        : null,
    }));

    res.json({
      notifications: normalized,
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    });
  } catch (err) {
    logger.error('Get notifications failed', { error: err.message });
    res.status(500).json({ message: 'Failed to load notifications.' });
  }
};

// @GET /api/notifications/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.user._id,
      isRead: false,
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get count.' });
  }
};

// @PUT /api/notifications/mark-read
exports.markRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    await deleteCache(`notif:unread:${req.user._id}`);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark notifications read.' });
  }
};

// @PUT /api/notifications/:id/read
exports.markOneRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { $set: { isRead: true } }
    );
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed.' });
  }
};