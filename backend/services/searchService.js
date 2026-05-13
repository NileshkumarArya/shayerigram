/**
 * Search Service — Abstracted Search Layer
 *
 * Phase 1: MongoDB regex search (simple, works up to ~50k posts)
 * Phase 2: Atlas Search (Lucene-based, free on M10+)
 * Phase 3: Meilisearch / Elasticsearch for advanced ranking
 *
 * To switch provider: change SEARCH_PROVIDER env var
 * Interface stays the same — controllers don't change
 */
const Post = require('../models/Post');
const User = require('../models/User');
const logger = require('../utils/logger');

const PROVIDER = process.env.SEARCH_PROVIDER || 'mongo'; // 'mongo' | 'atlas' | 'meilisearch'

// ─── Mongo Regex Provider (Phase 1) ──────────────────────────────────────────
const mongoSearch = {
  async searchPosts(query, { limit = 20, cursor = null } = {}) {
    // ✅ Escape regex special chars — prevent ReDoS
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp(escaped, 'i');

    const filter = {
      isPublic:    true,
      isTakenDown: { $ne: true },
      $or: [
        { content: regex },
        { title:   regex },
        { hashtags: { $in: [query.toLowerCase()] } },
      ],
    };

    // Cursor support
    if (cursor) {
      try {
        const { createdAt, _id } = JSON.parse(Buffer.from(cursor, 'base64').toString());
        filter.$and = [{ $or: [
          { createdAt: { $lt: new Date(createdAt) } },
          { createdAt: new Date(createdAt), _id: { $lt: _id } },
        ]}];
      } catch {}
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('author', '_id username avatar fullName isVerified')
      .lean();

    const hasMore    = posts.length > limit;
    const items      = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ createdAt: items.at(-1).createdAt, _id: items.at(-1)._id })).toString('base64')
      : null;

    return { posts: items, hasMore, nextCursor };
  },

  async searchUsers(query, { limit = 20 } = {}) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp(`^${escaped}`, 'i'); // Prefix match — faster than contains

    const users = await User.find({
      isSuspended: { $ne: true },
      isDeleted:   { $ne: true },
      $or: [{ username: regex }, { fullName: new RegExp(escaped, 'i') }],
    })
      .select('_id username fullName avatar isVerified followersCount')
      .sort({ followersCount: -1 })
      .limit(limit)
      .lean();

    return { users };
  },

  async searchHashtags(query, { limit = 10 } = {}) {
    // Group posts by hashtag — find trending tags matching query
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tags = await Post.aggregate([
      { $match: { isPublic: true, hashtags: { $regex: new RegExp(`^${escaped}`, 'i') } } },
      { $unwind: '$hashtags' },
      { $match: { hashtags: { $regex: new RegExp(`^${escaped}`, 'i') } } },
      { $group: { _id: '$hashtags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return { hashtags: tags.map(t => ({ tag: t._id, count: t.count })) };
  },
};

// ─── Atlas Search Provider (Phase 2 — uncomment when M10+ cluster) ───────────
// const atlasSearch = {
//   async searchPosts(query, options) { ... use $search aggregation ... },
//   async searchUsers(query, options) { ... },
//   async searchHashtags(query, options) { ... },
// };

// ─── Provider Router ──────────────────────────────────────────────────────────
const providers = { mongo: mongoSearch };
const provider  = providers[PROVIDER] || mongoSearch;

if (PROVIDER !== 'mongo') {
  logger.warn(`Search provider '${PROVIDER}' not found — falling back to mongo`);
}

module.exports = {
  searchPosts:    (...args) => provider.searchPosts(...args),
  searchUsers:    (...args) => provider.searchUsers(...args),
  searchHashtags: (...args) => provider.searchHashtags(...args),
};
