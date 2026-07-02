const mongoose = require('mongoose');
const { injectAdSlots } = require('./adService');
/**
 * Feed Service — dedicated feed business logic
 * getFeed = Smart Feed (70% popular / 30% new-writer discovery mix)
 * getExploreFeed = plain public feed for /explore
 */
const Post   = require('../models/Post');
const Like   = require('../models/Like');
const Save   = require('../models/Save');
const Block  = require('../models/Block');
const { getCache, setCache } = require('../utils/cache');
const { buildCursorPagination, encodeCursor } = require('../utils/pagination');

/**
 * Get personalized feed for a user
 * Phase 1: Recent posts from followed users + own posts
 * Future Phase 2: Add ranking score, trending mix
 * Future Phase 3: Precomputed fanout feed
 */
/**
 * Smart Feed — 70% popular content + 30% new-writer content, interleaved.
 * "Popular" = ranked by engagement score (likes + comments*2 + views), recent-first.
 * "New writer" = posts from authors with <200 followers, most-recent-first (equal chance to grow).
 *
 * Uses page-number pagination (not cursor) since ranking isn't stable across time
 * the way createdAt is. Frontend sends `exclude` (comma-separated post IDs already
 * shown) on "load more" calls to avoid duplicates across pages.
 */
const getFeed = async (userId, query = {}) => {
  const page  = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 30);
  const excludeIds = query.exclude ? String(query.exclude).split(',').filter(Boolean) : [];

  const isFirstPage = page === 1 && excludeIds.length === 0;

  // ── Cache first page ──────────────────────────────────────────────────
  if (isFirstPage) {
    const cached = await getCache(`feed:first:${userId}`);
    if (cached) return { ...cached, cached: true };
  }

  const blocks = await Block.find({
    $or: [{ blockerId: userId }, { blockeeId: userId }],
  }).select('blockerId blockeeId').lean();
  const blockedUserIds = blocks.map(b =>
    String(b.blockerId) === String(userId) ? b.blockeeId : b.blockerId
  );

  const baseMatch = {
    isPublic:    true,
    isDeleted:   { $ne: true },
    isTakenDown: { $ne: true },
    author:      { $nin: blockedUserIds },
    _id:         { $nin: excludeIds.map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } }).filter(Boolean) },
  };

  const popularCount   = Math.ceil(limit * 0.7);
  const newWriterCount = limit - popularCount;
  const scoreStage = {
    $addFields: {
      score: {
        $add: [
          { $ifNull: ['$likesCount',    0] },
          { $multiply: [{ $ifNull: ['$commentsCount', 0] }, 2] },
          { $ifNull: ['$views',         0] },
        ],
      },
    },
  };

  // ── Popular pool — last 30 days, fallback to all-time if not enough ────
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let popularPosts = await Post.aggregate([
    { $match: { ...baseMatch, createdAt: { $gte: since } } },
    scoreStage,
    { $sort: { score: -1, createdAt: -1 } },
    { $skip: (page - 1) * popularCount },
    { $limit: popularCount + 1 },
  ]);
  if (popularPosts.length < popularCount + 1) {
    popularPosts = await Post.aggregate([
      { $match: baseMatch },
      scoreStage,
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: popularCount + 1 },
    ]);
  }
  const popularHasMore = popularPosts.length > popularCount;
  popularPosts = popularPosts.slice(0, popularCount);

  // ── New-writer pool — authors with <200 followers, most recent first ───
  const newWriterPosts = await Post.aggregate([
    { $match: { ...baseMatch, _id: { $nin: popularPosts.map(p => p._id) } } },
    { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'authorDoc' } },
    { $unwind: '$authorDoc' },
    { $match: { 'authorDoc.followersCount': { $lt: 200 } } },
    { $sort: { createdAt: -1 } },
    { $skip: (page - 1) * newWriterCount },
    { $limit: newWriterCount + 1 },
  ]);
  const newWriterHasMore = newWriterPosts.length > newWriterCount;
  const newWriterFinal = newWriterPosts.slice(0, newWriterCount);

  // ── Interleave roughly 7 popular : 3 new-writer ─────────────────────────
  const mixed = [];
  let pi = 0, ni = 0;
  while (pi < popularPosts.length || ni < newWriterFinal.length) {
    for (let i = 0; i < 7 && pi < popularPosts.length; i++) mixed.push(popularPosts[pi++]);
    for (let i = 0; i < 3 && ni < newWriterFinal.length; i++) mixed.push(newWriterFinal[ni++]);
  }

  const postIds = mixed.map(p => p._id);

  // ✅ Populate full docs + attach liked/saved status (batch queries — not N+1)
  const [populated, likedSet, savedSet] = await Promise.all([
    Post.find({ _id: { $in: postIds } })
      .populate('author', '_id username avatar fullName isVerified followersCount')
      .lean(),
    Like.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
    Save.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
  ]);
  const postMap  = new Map(populated.map(p => [String(p._id), p]));
  const likedIds = new Set(likedSet.map(l => String(l.postId)));
  const savedIds = new Set(savedSet.map(s => String(s.postId)));

  const itemsWithStatus = mixed
    .map(p => postMap.get(String(p._id)))
    .filter(Boolean)
    .map(p => ({ ...p, liked: likedIds.has(String(p._id)), saved: savedIds.has(String(p._id)) }));

  // ✅ Inject ad slots — backend controls ad frequency
  const feedWithAds = injectAdSlots(itemsWithStatus);
  const hasMore = popularHasMore || newWriterHasMore;
  const result  = { posts: feedWithAds, hasMore, nextPage: page + 1 };

  // ── Cache first page for 30 seconds ──────────────────────────────────
  if (isFirstPage && itemsWithStatus.length > 0) {
    await setCache(`feed:first:${userId}`, result, 30);
  }

  return result;
};

/**
 * Explore feed — public posts, no follow filter
 * Phase 1: Trending + recent
 */
const getExploreFeed = async (query = {}) => {
  const { filter: cursorFilter, sort, limit } = buildCursorPagination(query);

  const posts = await Post
    .find({
      isPublic: true,
      isTakenDown: { $ne: true },
      ...cursorFilter,
    })
    .sort(sort)
    .limit(limit + 1)
    .populate('author', '_id username avatar fullName isVerified')
    .lean();

  const hasMore = posts.length > limit;
  const items   = hasMore ? posts.slice(0, limit) : posts;

  return {
    posts: items,
    hasMore,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
  };
};

module.exports = { getFeed, getExploreFeed };
