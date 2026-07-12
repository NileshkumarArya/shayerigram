const Report          = require('../models/Report');
const AdminLog        = require('../models/AdminLog');
const Post            = require('../models/Post');
const Story           = require('../models/Story');
const Chapter         = require('../models/Chapter');
const User            = require('../models/User');
const CopyrightStrike = require('../models/CopyrightStrike');
const { enqueueNotification } = require('../jobs/queues/notificationQueue');
const logger    = require('../utils/logger');
const { buildCursorPagination, encodeCursor } = require('../utils/pagination');

// Copyright reports only make sense against authored content, not
// user/comment targets — those fall through applyCopyrightStrike() as a no-op.
const COPYRIGHT_TARGET_MODELS = { post: Post, story: Story, chapter: Chapter };
const STRIKE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // 90-day rolling window, same as YouTube

// Active strikes = issued within the last 90 days AND not paused/cleared by
// a dispute. A 'pending' dispute excludes the strike from the count until
// an admin rules on it — not an automatic dismissal, just paused.
const getActiveStrikeCount = (userId) =>
  CopyrightStrike.countDocuments({
    user: userId,
    createdAt: { $gte: new Date(Date.now() - STRIKE_WINDOW_MS) },
    disputeStatus: { $nin: ['pending', 'overturned'] },
  });

const suspendIfThresholdReached = async (userId, adminId, req) => {
  const user = await User.findById(userId).select('_id isSuspended');
  if (!user || user.isSuspended) return;

  const activeCount = await getActiveStrikeCount(userId);
  if (activeCount >= 3) {
    await User.findByIdAndUpdate(userId, { isSuspended: true });
    auditLog(adminId, 'SUSPEND_USER', userId, 'User',
      `Auto-suspended: ${activeCount} active copyright strikes in trailing 90 days`, req);
    logger.warn('User auto-suspended for copyright strikes', { userId, activeCount, by: adminId });
  }
};

// Soft takedown (reversible) — never a hard delete, since an overturned
// dispute needs to be able to bring the content back.
const takeDownStruckContent = async (targetType, targetId) => {
  if (targetType === 'post')    await Post.findByIdAndUpdate(targetId, { isTakenDown: true });
  if (targetType === 'story') {
    await Story.findByIdAndUpdate(targetId, { isTakenDown: true });
    await Chapter.updateMany({ story: targetId }, { isTakenDown: true });
  }
  if (targetType === 'chapter') await Chapter.findByIdAndUpdate(targetId, { isTakenDown: true });
};

const restoreStruckContent = async (targetType, targetId) => {
  if (targetType === 'post')    await Post.findByIdAndUpdate(targetId, { isTakenDown: false });
  if (targetType === 'story') {
    await Story.findByIdAndUpdate(targetId, { isTakenDown: false });
    await Chapter.updateMany({ story: targetId, isTakenDown: true }, { isTakenDown: false });
  }
  if (targetType === 'chapter') await Chapter.findByIdAndUpdate(targetId, { isTakenDown: false });
};

// Applies one strike to a content's author. Called only on the transition
// into 'resolved' for a copyright-reason report (guarded in reviewReport so
// re-saving an already-resolved report can't double-strike).
const applyCopyrightStrike = async (report, adminId, req) => {
  const Model = COPYRIGHT_TARGET_MODELS[report.targetType];
  if (!Model) return;

  const content = await Model.findById(report.targetId).select('author').lean();
  if (!content) return;

  await CopyrightStrike.create({
    user: content.author, report: report._id,
    targetType: report.targetType, targetId: report.targetId, issuedBy: adminId,
  });

  // Lifetime historical total, for admin visibility only — suspension is
  // decided by the live 90-day rolling count above, not this raw total.
  await User.findByIdAndUpdate(content.author, { $inc: { copyrightStrikes: 1 } });

  await takeDownStruckContent(report.targetType, report.targetId);

  enqueueNotification({
    recipientId: content.author, actorId: adminId,
    type: 'copyright_strike', entityId: report.targetId,
    entityType: report.targetType.charAt(0).toUpperCase() + report.targetType.slice(1),
  }).catch(() => {});

  auditLog(adminId, 'COPYRIGHT_STRIKE', content.author, 'User', `Report ${report._id}`, req);

  await suspendIfThresholdReached(content.author, adminId, req);
};

// @GET /api/admin/copyright-strikes
exports.getCopyrightStrikes = async (req, res) => {
  try {
    const { status = 'all', limit = 50 } = req.query;
    const filter = status !== 'all' ? { disputeStatus: status } : {};

    const strikes = await CopyrightStrike.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('user', '_id username')
      .populate('issuedBy', '_id username')
      .populate('report', 'reason details')
      .lean();

    res.json({ strikes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load strikes.' });
  }
};

// @PATCH /api/admin/copyright-strikes/:id/resolve
exports.resolveDispute = async (req, res) => {
  try {
    const { verdict } = req.body; // 'upheld' | 'overturned'
    if (!['upheld', 'overturned'].includes(verdict)) {
      return res.status(400).json({ message: 'Verdict must be upheld or overturned.' });
    }

    const strike = await CopyrightStrike.findById(req.params.id);
    if (!strike) return res.status(404).json({ message: 'Strike not found.' });
    if (strike.disputeStatus !== 'pending') {
      return res.status(400).json({ message: 'This strike has no pending dispute.' });
    }

    strike.disputeStatus     = verdict;
    strike.disputeResolvedBy = req.user._id;
    strike.disputeResolvedAt = new Date();
    await strike.save();

    if (verdict === 'overturned') {
      await User.findByIdAndUpdate(strike.user, { $inc: { copyrightStrikes: -1 } });
      await restoreStruckContent(strike.targetType, strike.targetId);
      auditLog(req.user._id, 'COPYRIGHT_STRIKE_OVERTURNED', strike.user, 'User', `Strike ${strike._id}`, req);
    } else {
      auditLog(req.user._id, 'COPYRIGHT_STRIKE_UPHELD', strike.user, 'User', `Strike ${strike._id}`, req);
      await suspendIfThresholdReached(strike.user, req.user._id, req);
    }

    res.json({ message: `Dispute ${verdict}.`, strike });
  } catch (err) {
    res.status(500).json({ message: 'Failed to resolve dispute.' });
  }
};

// ─── Audit log helper ────────────────────────────────────────────────────────
const auditLog = (adminId, action, targetId, targetType, reason, req, meta = {}) =>
  AdminLog.create({ adminId, action, targetId, targetType, reason, ip: req.ip, meta }).catch(() => {});

// ✅ SECURITY FIX: Prevent admin from acting on another admin (privilege escalation)
const ensureNotAdmin = async (targetId, res, action) => {
  const target = await User.findById(targetId).select('role _id').lean();
  if (!target) { res.status(404).json({ message: 'User not found.' }); return null; }
  if (target.role === 'admin') {
    res.status(403).json({ message: `Cannot ${action} another admin account.` });
    return null;
  } 
  return target;
};

// ✅ SECURITY FIX: Prevent admin from acting on themselves
const ensureNotSelf = (adminId, targetId, res, action) => {
  if (String(adminId) === String(targetId)) {
    res.status(400).json({ message: `Cannot ${action} your own account.` });
    return false;
  }
  return true;
};

// @GET /api/admin/stats
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, totalPosts, openReports, suspendedUsers] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments({ isPublic: true, isTakenDown: { $ne: true } }),
      Report.countDocuments({ status: 'open' }),
      User.countDocuments({ isSuspended: true }),
    ]);
    res.json({ totalUsers, totalPosts, openReports, suspendedUsers });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get stats.' });
  }
};

// @GET /api/admin/reports (cursor-paginated)
exports.getReports = async (req, res) => {
  try {
    const status = req.query.status || 'open';
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);
    const filter = status === 'all' ? { ...cursorFilter } : { status, ...cursorFilter };

    const reports = await Report.find(filter)
      .sort(sort)
      .limit(limit + 1)
      .populate('reportedBy', '_id username avatar')
      .populate('reviewedBy', '_id username')
      .lean();

    const hasMore = reports.length > limit;
    const items   = hasMore ? reports.slice(0, limit) : reports;

    res.json({
      reports:    items,
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    });
  } catch (err) {
    logger.error('Get reports failed', { error: err.message });
    res.status(500).json({ message: 'Failed to fetch reports.' });
  }
};

// @PATCH /api/admin/reports/:id
exports.reviewReport = async (req, res) => {
  try {
    // ✅ BUG FIX: this whitelist previously listed 'dismissed'/'actioned',
    // which aren't valid values in Report.js's schema enum — every
    // 'resolved' or 'rejected' call from the frontend was being rejected
    // here before it could even reach the schema.
    const VALID_STATUSES = ['open', 'reviewed', 'resolved', 'rejected'];
    const { status, actionTaken } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });

    const wasAlreadyResolved = report.status === 'resolved';

    report.status      = status      || report.status;
    report.actionTaken = typeof actionTaken === 'string' ? actionTaken.slice(0, 500) : '';
    report.reviewedBy  = req.user._id;
    report.reviewedAt  = new Date();
    await report.save();

    // Copyright strike — only on the transition into 'resolved', so
    // re-saving an already-resolved report doesn't strike the user twice
    if (status === 'resolved' && !wasAlreadyResolved && report.reason === 'copyright') {
      await applyCopyrightStrike(report, req.user._id, req).catch((err) =>
        logger.error('applyCopyrightStrike failed', { error: err.message, reportId: report._id })
      );
    }

    // ✅ Audit log
    auditLog(req.user._id, 'REVIEW_REPORT', report._id, 'Report', actionTaken, req, { status });

    logger.warn('Report reviewed', { by: req.user.username, reportId: report._id, action: actionTaken });
    res.json({ message: 'Report updated.', report });
  } catch (err) {
    res.status(500).json({ message: 'Failed to review report.' });
  }
};

// @PATCH /api/admin/posts/:id/takedown
exports.removePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id, { isTakenDown: true }, { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    enqueueNotification({
      recipientId: post.author, actorId: req.user._id,
      type: 'takedown', entityId: post._id, entityType: 'Post',
      reasonText: req.body.reason || 'Violation of community guidelines.',
    }).catch(() => {});

    // ✅ Audit log
    auditLog(req.user._id, 'TAKEDOWN_POST', post._id, 'Post', req.body.reason || '', req);

    logger.warn('Post taken down', { postId: post._id, by: req.user.username });
    res.json({ message: 'Post removed from public view.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove post.' });
  }
};

// @PATCH /api/admin/users/:id/suspend
exports.suspendUser = async (req, res) => {
  try {
    // ✅ SECURITY FIX: Cannot suspend self or another admin
    if (!ensureNotSelf(req.user._id, req.params.id, res, 'suspend')) return;
    const target = await ensureNotAdmin(req.params.id, res, 'suspend');
    if (!target) return;

    const suspend = req.body.suspend !== false; // default true
    const user = await User.findByIdAndUpdate(
      req.params.id, { isSuspended: suspend }, { new: true }
    ).select('_id username isSuspended');

    // ✅ Audit log
    auditLog(req.user._id, suspend ? 'SUSPEND_USER' : 'UNSUSPEND_USER', user._id, 'User',
      req.body.reason || '', req);

    logger.warn(`User ${suspend ? 'suspended' : 'unsuspended'}`, { userId: user._id, by: req.user.username });
    res.json({ message: `User ${suspend ? 'suspended' : 'unsuspended'} successfully.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user status.' });
  }
};

// @PATCH /api/admin/posts/:id/restore — Restore soft-deleted post
exports.restorePost = async (req, res) => {
  try {
    const post = await Post.findWithDeleted({ _id: req.params.id }).findOne();
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    await Post.findByIdAndUpdate(req.params.id, {
      $set: { isDeleted: false, deletedAt: null, deletedBy: null, isTakenDown: false },
    });

    // ✅ Audit log
    auditLog(req.user._id, 'RESTORE_POST', req.params.id, 'Post', '', req);

    logger.warn('Post restored by admin', { postId: req.params.id, by: req.user.username });
    res.json({ message: 'Post restored successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to restore post.' });
  }
};

// @DELETE /api/admin/posts/:id/hard-delete — Permanent delete (irreversible)
exports.hardDeletePost = async (req, res) => {
  try {
    const cloudinary = require('cloudinary').v2;
    const post = await Post.findWithDeleted({ _id: req.params.id }).findOne();
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    if (post.imagePublicId) {
      cloudinary.uploader.destroy(post.imagePublicId).catch(() => {});
    }

    await Post.findByIdAndDelete(req.params.id);

    // ✅ Audit log
    auditLog(req.user._id, 'HARD_DELETE_POST', req.params.id, 'Post', req.body.reason || '', req);

    logger.warn('Post HARD DELETED by admin', { postId: req.params.id, by: req.user.username });
    res.json({ message: 'Post permanently deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete post.' });
  }
};

// @PATCH /api/admin/users/:id/soft-delete — Soft delete user
exports.softDeleteUser = async (req, res) => {
  try {
    // ✅ SECURITY FIX: Cannot delete self or another admin
    if (!ensureNotSelf(req.user._id, req.params.id, res, 'delete')) return;
    const target = await ensureNotAdmin(req.params.id, res, 'delete');
    if (!target) return;

    const { reason = '' } = req.body;

    const user = await User.findByIdAndUpdate(req.params.id, {
      $set: {
        isDeleted:      true,
        deletedAt:      new Date(),
        deletedBy:      req.user._id,
        deletionReason: typeof reason === 'string' ? reason.slice(0, 200) : '',
        isSuspended:    true,
      },
    }, { new: true }).select('username _id');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    // ✅ Audit log
    auditLog(req.user._id, 'SOFT_DELETE_USER', user._id, 'User', reason, req);

    logger.warn('User soft-deleted', { userId: user._id, by: req.user.username, reason });
    res.json({ message: 'User account deleted.', user });
  } catch (err) {
    res.status(500).json({ message: 'Failed.' });
  }
};

// @GET /api/admin/posts/deleted — List soft-deleted posts
exports.getDeletedPosts = async (req, res) => {
  try {
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);

    const posts = await Post.findWithDeleted({ isDeleted: true, ...cursorFilter })
      .sort(sort).limit(limit + 1)
      .populate('author', '_id username')
      .populate('deletedBy', '_id username')
      .lean();

    const hasMore = posts.length > limit;
    const items   = hasMore ? posts.slice(0, limit) : posts;
    res.json({ posts: items, hasMore, nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load deleted posts.' });
  }
};

// @PATCH /api/admin/stories/:id/takedown
exports.removeStory = async (req, res) => {
  try {
    const story = await Story.findByIdAndUpdate(
      req.params.id, { isTakenDown: true }, { new: true }
    );
    if (!story) return res.status(404).json({ message: 'Story not found.' });

    // Cascade — getChapter() doesn't check parent story status, so a taken-down
    // story's chapters would still be directly readable without this
    await Chapter.updateMany({ story: story._id }, { isTakenDown: true });

    enqueueNotification({
      recipientId: story.author, actorId: req.user._id,
      type: 'takedown', entityId: story._id, entityType: 'Story',
      reasonText: req.body.reason || 'Violation of community guidelines.',
    }).catch(() => {});

    // ✅ Audit log
    auditLog(req.user._id, 'TAKEDOWN_STORY', story._id, 'Story', req.body.reason || '', req);

    logger.warn('Story taken down', { storyId: story._id, by: req.user.username });
    res.json({ message: 'Story removed from public view.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove story.' });
  }
};

// @PATCH /api/admin/stories/:id/restore — Restore soft-deleted/taken-down story
exports.restoreStory = async (req, res) => {
  try {
    const story = await Story.findWithDeleted({ _id: req.params.id }).findOne();
    if (!story) return res.status(404).json({ message: 'Story not found.' });

    await Story.findByIdAndUpdate(req.params.id, {
      $set: { isDeleted: false, deletedAt: null, deletedBy: null, isTakenDown: false },
    });

    // Reverse the cascade — only chapters currently taken down, so we don't
    // touch ones a chapter-level report independently took down
    await Chapter.updateMany({ story: req.params.id, isTakenDown: true }, { isTakenDown: false });

    // ✅ Audit log
    auditLog(req.user._id, 'RESTORE_STORY', req.params.id, 'Story', '', req);

    logger.warn('Story restored by admin', { storyId: req.params.id, by: req.user.username });
    res.json({ message: 'Story restored successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to restore story.' });
  }
};

// @DELETE /api/admin/stories/:id/hard-delete — Permanent delete (irreversible), cascades to chapters
exports.hardDeleteStory = async (req, res) => {
  try {
    const cloudinary = require('cloudinary').v2;
    const story = await Story.findWithDeleted({ _id: req.params.id }).findOne();
    if (!story) return res.status(404).json({ message: 'Story not found.' });

    // A hard-deleted story can't leave dangling chapters pointing at nothing,
    // so children get destroyed too (their own cloudinary assets included)
    const chapters = await Chapter.findWithDeleted({ story: story._id });
    for (const ch of chapters) {
      if (ch.audioPublicId) cloudinary.uploader.destroy(ch.audioPublicId, { resource_type: 'video' }).catch(() => {});
      if (ch.coverImagePublicId) cloudinary.uploader.destroy(ch.coverImagePublicId).catch(() => {});
    }
    await Chapter.deleteMany({ story: story._id });

    if (story.coverImagePublicId) {
      cloudinary.uploader.destroy(story.coverImagePublicId).catch(() => {});
    }
    await Story.findByIdAndDelete(req.params.id);

    // ✅ Audit log
    auditLog(req.user._id, 'HARD_DELETE_STORY', req.params.id, 'Story', req.body.reason || '', req,
      { chaptersDeleted: chapters.length });

    logger.warn('Story HARD DELETED by admin', { storyId: req.params.id, by: req.user.username, chaptersDeleted: chapters.length });
    res.json({ message: `Story and ${chapters.length} chapter(s) permanently deleted.` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete story.' });
  }
};

// @GET /api/admin/stories/deleted — List soft-deleted stories
exports.getDeletedStories = async (req, res) => {
  try {
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);

    const stories = await Story.findWithDeleted({ isDeleted: true, ...cursorFilter })
      .sort(sort).limit(limit + 1)
      .populate('author', '_id username')
      .populate('deletedBy', '_id username')
      .lean();

    const hasMore = stories.length > limit;
    const items   = hasMore ? stories.slice(0, limit) : stories;
    res.json({ stories: items, hasMore, nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load deleted stories.' });
  }
};

// @PATCH /api/admin/chapters/:id/takedown
exports.removeChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndUpdate(
      req.params.id, { isTakenDown: true }, { new: true }
    );
    if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });

    enqueueNotification({
      recipientId: chapter.author, actorId: req.user._id,
      type: 'takedown', entityId: chapter._id, entityType: 'Chapter',
      reasonText: req.body.reason || 'Violation of community guidelines.',
    }).catch(() => {});

    // ✅ Audit log
    auditLog(req.user._id, 'TAKEDOWN_CHAPTER', chapter._id, 'Chapter', req.body.reason || '', req);

    logger.warn('Chapter taken down', { chapterId: chapter._id, by: req.user.username });
    res.json({ message: 'Chapter removed from public view.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove chapter.' });
  }
};

// @PATCH /api/admin/chapters/:id/restore — Restore soft-deleted/taken-down chapter
exports.restoreChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findWithDeleted({ _id: req.params.id }).findOne();
    if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });

    await Chapter.findByIdAndUpdate(req.params.id, {
      $set: { isDeleted: false, deletedAt: null, deletedBy: null, isTakenDown: false },
    });

    // ✅ Audit log
    auditLog(req.user._id, 'RESTORE_CHAPTER', req.params.id, 'Chapter', '', req);

    logger.warn('Chapter restored by admin', { chapterId: req.params.id, by: req.user.username });
    res.json({ message: 'Chapter restored successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to restore chapter.' });
  }
};

// @DELETE /api/admin/chapters/:id/hard-delete — Permanent delete (irreversible)
exports.hardDeleteChapter = async (req, res) => {
  try {
    const cloudinary = require('cloudinary').v2;
    const chapter = await Chapter.findWithDeleted({ _id: req.params.id }).findOne();
    if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });

    if (chapter.audioPublicId) {
      cloudinary.uploader.destroy(chapter.audioPublicId, { resource_type: 'video' }).catch(() => {});
    }
    if (chapter.coverImagePublicId) {
      cloudinary.uploader.destroy(chapter.coverImagePublicId).catch(() => {});
    }

    // Only decrement if this chapter was still counted — if the author had
    // already soft-deleted it themselves, deleteChapter() already decremented once
    if (!chapter.isDeleted) {
      await Story.findByIdAndUpdate(chapter.story, { $inc: { totalChapters: -1 } });
    }

    await Chapter.findByIdAndDelete(req.params.id);

    // ✅ Audit log
    auditLog(req.user._id, 'HARD_DELETE_CHAPTER', req.params.id, 'Chapter', req.body.reason || '', req);

    logger.warn('Chapter HARD DELETED by admin', { chapterId: req.params.id, by: req.user.username });
    res.json({ message: 'Chapter permanently deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete chapter.' });
  }
};

// @GET /api/admin/chapters/deleted — List soft-deleted chapters
exports.getDeletedChapters = async (req, res) => {
  try {
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);

    const chapters = await Chapter.findWithDeleted({ isDeleted: true, ...cursorFilter })
      .sort(sort).limit(limit + 1)
      .populate('author', '_id username')
      .populate('story', '_id title')
      .populate('deletedBy', '_id username')
      .lean();

    const hasMore = chapters.length > limit;
    const items   = hasMore ? chapters.slice(0, limit) : chapters;
    res.json({ chapters: items, hasMore, nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load deleted chapters.' });
  }
};

// @GET /api/admin/logs — Admin action history
exports.getAdminLogs = async (req, res) => {
  try {
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);

    const logs = await AdminLog.find(cursorFilter)
      .sort(sort)
      .limit(limit + 1)
      .populate('adminId', 'username avatar')
      .lean();

    const hasMore = logs.length > limit;
    res.json({ logs: hasMore ? logs.slice(0, limit) : logs, hasMore });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get admin logs.' });
  }
};
