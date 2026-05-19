/**
 * Save Service — uses separate Save collection
 * No Post.savedBy[] or User.savedPosts[] arrays
 */
const Save = require('../models/Save');
const Post = require('../models/Post');
const User = require('../models/User');
const { invalidateCache } = require('../utils/cache');

const toggleSave = async (userId, postId) => {
  const targetPost = await Post.findOne({
    _id: postId,
    isDeleted: { $ne: true },
    isTakenDown: { $ne: true },
  }).select('_id');

  if (!targetPost) {
    throw Object.assign(new Error('Post not found'), { status: 404 });
  }

  const existing = await Save.findOne({ userId, postId });

  if (existing) {
    await Save.deleteOne({ _id: existing._id });
    await Promise.all([
      Post.findByIdAndUpdate(postId, { $inc: { savesCount: -1 } }),
      User.findByIdAndUpdate(userId, { $inc: { savedCount: -1 } }),
    ]);
    await invalidateCache([`post:${postId}`, `saved:${userId}`]);
    return { saved: false };
  } else {
    await Save.create({ userId, postId });
    await Promise.all([
      Post.findByIdAndUpdate(postId, { $inc: { savesCount: 1 } }),
      User.findByIdAndUpdate(userId, { $inc: { savedCount: 1 } }),
    ]);
    await invalidateCache([`post:${postId}`, `saved:${userId}`]);
    return { saved: true };
  }
};

const getSavedPosts = async (userId, query = {}) => {
  const { buildCursorPagination, encodeCursor } = require('../utils/pagination');
  const { filter: cursorFilter, sort, limit } = buildCursorPagination(query);

  const saves = await Save
    .find({ userId, ...cursorFilter })
    .sort(sort)
    .limit(limit + 1)
    .populate({
      path: 'postId',
      match: { isTakenDown: { $ne: true } },
      populate: { path: 'author', select: '_id username avatar isVerified' },
    })
    .lean();

  const hasMore = saves.length > limit;
  const items   = hasMore ? saves.slice(0, limit) : saves;
  const posts   = items.map(s => s.postId).filter(Boolean);

  return {
    posts,
    hasMore,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
  };
};



const isSaved = async (userId, postId) => {
  return !!(await Save.exists({ userId, postId }));
};

const getUserSavedPosts = async (userId, query = {}) => {
  const { filter: cursorFilter, sort, limit } = require('../utils/pagination').buildCursorPagination(query);
  const saves = await Save.find({ userId, ...cursorFilter })
    .sort(sort).limit(limit + 1).lean();
  const hasMore = saves.length > limit;
  const items = hasMore ? saves.slice(0, limit) : saves;
  const postIds = items.map(s => s.postId);
  const posts = await require('../models/Post').find({ _id: { $in: postIds }, isTakenDown: { $ne: true } })
    .populate('author', '_id username avatar isVerified')
    .lean();
  // ✅ FIX: Preserve ordering — $in does not guarantee order
  const postMap = new Map(posts.map(p => [String(p._id), p]));
  const orderedPosts = postIds.map(id => postMap.get(String(id))).filter(Boolean);
  return {
    posts: orderedPosts,
    hasMore,
    nextCursor: hasMore ? require('../utils/pagination').encodeCursor(items[items.length - 1]) : null,
  };
};

module.exports = { toggleSave, isSaved, getUserSavedPosts };
