const { injectAdSlots } = require('./adService');
/**
 * Feed Service — dedicated feed business logic
 * Future-ready: easily extendable for ranking, fanout, recommendation
 */
const Post   = require('../models/Post');
const Follow = require('../models/Follow');
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
const getFeed = async (userId, query = {}) => {
  const { filter: cursorFilter, sort, limit } = buildCursorPagination(query);
  const isFirstPage = !query.cursor;

  // ── Cache first page ──────────────────────────────────────────────────
  if (isFirstPage) {
    const cached = await getCache(`feed:first:${userId}`);
    if (cached) return { ...cached, cached: true };
  }

  // ── Get followed user IDs ─────────────────────────────────────────────
   const [follows, blocks] = await Promise.all([
    Follow.find({ followerId: userId }).select('followingId').lean(),
    Block.find({
      $or: [{ blockerId: userId }, { blockeeId: userId }],
    }).select('blockerId blockeeId').lean(),
  ]);

  const followedIds = follows.map(f => f.followingId);
  const blockedUserIds = blocks.map(b =>
    String(b.blockerId) === String(userId) ? b.blockeeId : b.blockerId
  );

  const authors = [...followedIds, userId]; // Include own posts

  // Kisi ko follow nahi kiya — sab public posts dikhao, blocked users ko hata ke
  const authorFilter = followedIds.length > 0
    ? { author: { $in: authors, ...(blockedUserIds.length ? { $nin: blockedUserIds } : {}) } }
    : (blockedUserIds.length ? { author: { $nin: blockedUserIds } } : {});

  // ── Fetch posts with cursor pagination ────────────────────────────────
  const posts = await Post
    .find({
      ...authorFilter,
      isPublic: true,
      isTakenDown: { $ne: true },
      ...cursorFilter,
    })
    .sort(sort)
    .limit(limit + 1) // fetch one extra to know hasMore
    .populate('author', '_id username avatar fullName isVerified followersCount')
    .lean();

  const hasMore = posts.length > limit;
  const items   = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;

  // ✅ Attach liked/saved status for current user (batch query — not N+1)
  const postIds = items.map(p => p._id);
  const [likedSet, savedSet] = await Promise.all([
    Like.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
    Save.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
  ]);
  const likedIds = new Set(likedSet.map(l => String(l.postId)));
  const savedIds = new Set(savedSet.map(s => String(s.postId)));

  const itemsWithStatus = items.map(p => ({
    ...p,
    liked: likedIds.has(String(p._id)),
    saved: savedIds.has(String(p._id)),
  }));

  // ✅ Inject ad slots — backend controls ad frequency
  const feedWithAds = injectAdSlots(itemsWithStatus);
  const result = { posts: feedWithAds, hasMore, nextCursor };

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
