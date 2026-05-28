/**
 * Save Service — uses separate Save collection
 * No Post.savedBy[] or User.savedPosts[] arrays
 */
const Save = require('../models/Save');
const Post = require('../models/Post');
const User = require('../models/User');
const Block = require('../models/Block');
const { invalidateCache } = require('../utils/cache');

const toggleSave = async (userId, postId) => {
  const post = await Post.findOne({
    _id: postId,
    isDeleted:   { $ne: true },
    isTakenDown: { $ne: true },
  }).select('author');

  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

  if (String(post.author) !== String(userId)) {
    const blocked = await Block.exists({
      $or: [
        { blockerId: userId,      blockeeId: post.author },
        { blockerId: post.author, blockeeId: userId },
      ],
    });
    if (blocked) throw Object.assign(new Error('Post not found'), { status: 404 });
  }

  // ✅ FIX: seedha deleteOne — race condition safe
  const removed = await Save.deleteOne({ userId, postId });

  if (removed.deletedCount > 0) {
    await Promise.all([
      Post.findOneAndUpdate({ _id: postId, savesCount: { $gt: 0 } }, { $inc: { savesCount: -1 } }),
      User.findOneAndUpdate({ _id: userId, savedCount: { $gt: 0 } }, { $inc: { savedCount: -1 } }),
    ]);
    await invalidateCache([`post:${postId}`, `saved:${userId}`]);
    return { saved: false };
  }

  // ✅ FIX: duplicate save race condition handle karo
  try {
    await Save.create({ userId, postId });
  } catch (err) {
    if (err.code === 11000) return { saved: true };
    throw err;
  }

  await Promise.all([
    Post.findByIdAndUpdate(postId, { $inc: { savesCount: 1 } }),
    User.findByIdAndUpdate(userId, { $inc: { savedCount: 1 } }),
  ]);
  await invalidateCache([`post:${postId}`, `saved:${userId}`]);
  return { saved: true };
};

const isSaved = async (userId, postId) => {
  return !!(await Save.exists({ userId, postId }));
};

const getUserSavedPosts = async (userId, query = {}) => {
  const { buildCursorPagination, encodeCursor } = require('../utils/pagination');
  const { filter: cursorFilter, sort, limit } = buildCursorPagination(query);

  const blocks = await Block.find({
    $or: [{ blockerId: userId }, { blockeeId: userId }],
  }).select('blockerId blockeeId').lean();

  const blockedUserIds = blocks.map(b =>
    String(b.blockerId) === String(userId) ? b.blockeeId : b.blockerId
  );

  const saves = await Save.find({ userId, ...cursorFilter })
    .sort(sort)
    .limit(limit + 1)
    .lean();

  const hasMore = saves.length > limit;
  const items   = hasMore ? saves.slice(0, limit) : saves;
  const postIds = items.map(s => s.postId);

  const posts = await Post.find({
    _id: { $in: postIds },
    isDeleted:   { $ne: true },
    isTakenDown: { $ne: true },
    ...(blockedUserIds.length ? { author: { $nin: blockedUserIds } } : {}),
  })
    .populate({
      path: 'author',
      select: '_id username avatar isVerified',
      match: { isDeleted: { $ne: true }, isSuspended: { $ne: true } },
    })
    .lean();

  const postMap = new Map(
    posts.filter(p => p.author).map(p => [String(p._id), p])
  );

  const orderedPosts = postIds.map(id => postMap.get(String(id))).filter(Boolean);

  return {
    posts: orderedPosts,
    hasMore,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
  };
};

module.exports = { toggleSave, isSaved, getUserSavedPosts };