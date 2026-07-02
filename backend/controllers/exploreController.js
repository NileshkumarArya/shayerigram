
// ─── Attach liked/saved status for logged-in user ─────────────────────────────
async function attachUserStatus(posts, userId) {
  if (!userId || !posts.length) return posts;
  const Like = require('../models/Like');
  const Save = require('../models/Save');
  const postIds = posts.map(p => p._id);
  const [likes, saves] = await Promise.all([
    Like.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
    Save.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
  ]);
  const likedSet = new Set(likes.map(l => String(l.postId)));
  const savedSet = new Set(saves.map(s => String(s.postId)));
  return posts.map(p => ({
    ...p,
    liked: likedSet.has(String(p._id)),
    saved: savedSet.has(String(p._id)),
  }));
}

const Post          = require('../models/Post');
const Block         = require('../models/Block');
const Follow        = require('../models/Follow');
const searchService = require('../services/searchService');
const User = require('../models/User');
const { buildCursorPagination, encodeCursor } = require('../utils/pagination');
const { getCache, setCache } = require('../utils/cache');
const logger = require('../utils/logger');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getBlockedUserIds(userId) {
  if (!userId) return [];

  const blocks = await Block.find({
    $or: [{ blockerId: userId }, { blockeeId: userId }],
  }).select('blockerId blockeeId').lean();

  return blocks.map(b =>
    String(b.blockerId) === String(userId) ? b.blockeeId : b.blockerId
  );
}

// ─── Search ───────────────────────────────────────────────────────────────────
exports.search = async (req, res) => {
  try {
        const { q, type = 'all', cursor } = req.query;
    if (!q?.trim()) return res.json({ posts: [], users: [], hashtags: [] });
    const query   = String(q).trim().slice(0, 50);
    const blockedUserIds = await getBlockedUserIds(req.user?._id);
    const results = {};

    // ✅ Use abstracted searchService — swap provider via SEARCH_PROVIDER env
    if (type === 'all' || type === 'posts') {
            const r = await searchService.searchPosts(query, { cursor, excludeUserIds: blockedUserIds });
      results.posts      = r.posts;
      results.nextCursor = r.nextCursor;
      results.hasMore    = r.hasMore;
    }
    if (type === 'all' || type === 'stories') {
      const r = await searchService.searchStories(query, { cursor, excludeUserIds: blockedUserIds });
      results.stories           = r.stories;
      results.storiesHasMore    = r.hasMore;
      results.storiesNextCursor = r.nextCursor;
    }
    if (type === 'all' || type === 'users') {
      const r = await searchService.searchUsers(query, { excludeUserIds: blockedUserIds });
      results.users = r.users;
    }
    if (type === 'all' || type === 'hashtags') {
       const r = await searchService.searchHashtags(query, { excludeUserIds: blockedUserIds });
      results.hashtags = r.hashtags;
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Search failed.' });
  }
};


exports.getAllPosts = async (req, res) => {
  try {
       const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);
    const userId = req.user?._id;
    const blockedUserIds = await getBlockedUserIds(userId);

    const posts = await Post.find({
      isPublic:    true,
      isDeleted:   { $ne: true },
      isTakenDown: { $ne: true },
      ...(blockedUserIds.length ? { author: { $nin: blockedUserIds } } : {}),
      ...cursorFilter,
    })
      .sort(sort)
      .limit(limit + 1)
      .populate('author', '_id username avatar isVerified fullName')
      .lean();

    const hasMore = posts.length > limit;
    const items   = hasMore ? posts.slice(0, limit) : posts;

        const enriched = await attachUserStatus(items, userId);

    res.json({
      posts:      enriched,
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    });
  } catch (err) {
    logger.error('Get all posts failed', { error: err.message });
    res.status(500).json({ message: 'Failed to load posts.' });
  }
};

// ─── By Category (cursor-paginated) ──────────────────────────────────────────
const VALID_CATEGORIES = ['Love', 'Sad', 'Motivational', 'Funny', 'Spiritual', 'Nature', 'Life', 'Friendship', 'Patriotic', 'Other'];

exports.getByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    if (!VALID_CATEGORIES.includes(category))
      return res.status(400).json({ message: 'Invalid category' });

    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);

    const posts = await Post.find({
      $or:         [{ categories: category }, { category }],
      isPublic:    true,
      isDeleted:   { $ne: true },
      isTakenDown: { $ne: true },
      ...cursorFilter,
    })
      .sort(sort)
      .limit(limit + 1)
      .populate('author', '_id username avatar isVerified fullName')
      .lean();

    const hasMore = posts.length > limit;
    const items   = hasMore ? posts.slice(0, limit) : posts;

    const userId = req.user?._id;
    const enriched = await attachUserStatus(items, userId);

    res.json({
      posts:      enriched,
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load category.' });
  }
};

// ─── By Hashtag ───────────────────────────────────────────────────────────────
exports.getByHashtag = async (req, res) => {
  try {
    const safeTag = String(req.params.tag)
      .replace(/[^a-zA-Z0-9_\u0900-\u097F\u0600-\u06FF]/g, '')
      .slice(0, 50).toLowerCase();

    if (!safeTag) return res.status(400).json({ message: 'Invalid hashtag' });

    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);

    const posts = await Post.find({
      hashtags:    safeTag,
      isPublic:    true,
      isDeleted:   { $ne: true },
      isTakenDown: { $ne: true },
      ...cursorFilter,
    })
      .sort(sort).limit(limit + 1)
      .populate('author', '_id username avatar isVerified')
      .lean();

    const hasMore = posts.length > limit;
    const items   = hasMore ? posts.slice(0, limit) : posts;

    res.json({ posts: items, hasMore, nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load hashtag.' });
  }
};

// ─── Trending Stories (uses counters) ──────────────────────────────────────────
exports.getTrendingStories = async (req, res) => {
  try {
    const Story = require('../models/Story');
    const cached = await getCache('trending:stories');
    if (cached) return res.json({ stories: cached, cached: true });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const stories = await Story.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          status:    'published',
          isDeleted: false,
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $ifNull: ['$totalLikes',    0] },
              { $multiply: [{ $ifNull: ['$totalComments', 0] }, 2] },
              { $ifNull: ['$totalReads',    0] },
            ],
          },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: 20 },
    ]);

    const populated = await Story.populate(stories, {
      path: 'author', select: '_id username avatar isVerified',
    });

    await setCache('trending:stories', populated, 120);
    res.json({ stories: populated });
  } catch (err) {
    logger.error('Trending stories failed', { error: err.message });
    res.status(500).json({ message: 'Failed to load trending stories.' });
  }
};

// ─── New Writers Spotlight — low-follower creators with at least 1 published work ──
exports.getNewWriters = async (req, res) => {
  try {
    const excludeIds = [];
    if (req.user) {
      const [following, blockedUserIds] = await Promise.all([
        Follow.find({ followerId: req.user._id }).select('followingId').lean(),
        getBlockedUserIds(req.user._id),
      ]);
      excludeIds.push(req.user._id, ...following.map(f => f.followingId), ...blockedUserIds);
    }

    const newWriters = await User.find({
      _id:            { $nin: excludeIds },
      isSuspended:    { $ne: true },
      isDeleted:      { $ne: true },
      followersCount: { $lt: 200 },
      $or: [{ postsCount: { $gt: 0 } }, { storiesCount: { $gt: 0 } }],
    })
      .select('_id username avatar fullName bio followersCount postsCount storiesCount isVerified createdAt')
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    res.json({ users: newWriters });
  } catch (err) {
    logger.error('New writers failed', { error: err.message });
    res.status(500).json({ message: 'Failed to load new writers.' });
  }
};

// ─── Trending (uses counters) ─────────────────────────────────────────────────
exports.getTrending = async (req, res) => {
  try {
    const cached = await getCache('trending:posts');
    if (cached) return res.json({ posts: cached, cached: true });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const posts = await Post.aggregate([
      {
        $match: {
          createdAt:   { $gte: since },
          isPublic:    true,
          isDeleted:   { $ne: true },
          isTakenDown: { $ne: true },
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $ifNull: ['$likesCount',    0] },
              { $multiply: [{ $ifNull: ['$commentsCount', 0] }, 2] },
              { $ifNull: ['$views',         0] },
            ],
          },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: 20 },
    ]);

    const populated = await Post.populate(posts, {
      path: 'author', select: '_id username avatar isVerified',
    });

    await setCache('trending:posts', populated, 120);
    res.json({ posts: populated });
  } catch (err) {
    logger.error('Trending failed', { error: err.message });
    res.status(500).json({ message: 'Failed to load trending.' });
  }
};
