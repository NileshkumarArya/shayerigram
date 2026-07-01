const Report    = require('../models/Report');
const AdminLog  = require('../models/AdminLog');
const Post      = require('../models/Post');
const User      = require('../models/User');
const logger    = require('../utils/logger');
const { buildCursorPagination, encodeCursor } = require('../utils/pagination');

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
    // ✅ SECURITY FIX: Whitelist valid status values — no arbitrary string injection
    const VALID_STATUSES = ['open', 'reviewed', 'dismissed', 'actioned'];
    const { status, actionTaken } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });

    report.status      = status      || report.status;
    report.actionTaken = typeof actionTaken === 'string' ? actionTaken.slice(0, 500) : '';
    report.reviewedBy  = req.user._id;
    report.reviewedAt  = new Date();
    await report.save();

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
