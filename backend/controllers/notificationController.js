const Post = require('../models/Post');
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
      .filter(n => POST_NOTIFICATION_TYPES.has(n.type) && n.entityId)
      .map(n => n.entityId);

    const posts = postIds.length
      ? await Post.find({ _id: { $in: postIds }, isTakenDown: { $ne: true } })
          .select('_id type image content')
          .lean()
      : [];

    const postMap = new Map(posts.map(p => [String(p._id), p]));

        const normalized = items.map(n => ({
      ...n,
      sender: n.actorId || null,
      actor:  n.actorId || null,
      read:   n.isRead,
      post:   POST_NOTIFICATION_TYPES.has(n.type) && n.entityId
        ? postMap.get(String(n.entityId)) || null
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