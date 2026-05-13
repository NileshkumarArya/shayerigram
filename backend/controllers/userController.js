/**
 * User Controller — thin, delegates to services
 * All follow/save/profile logic uses separate collections
 */
const User         = require('../models/User');
const Post         = require('../models/Post');
const Follow       = require('../models/Follow');
const Like         = require('../models/Like');
const Save         = require('../models/Save');
const followService = require('../services/followService');
const saveService   = require('../services/saveService');
const { getCache, setCache, invalidateCache } = require('../utils/cache');
const { buildCursorPagination, encodeCursor } = require('../utils/pagination');
const { sanitizeString } = require('../middleware/security');
const cloudinary   = require('cloudinary').v2;
const logger       = require('../utils/logger');

// ─── Safe public profile shape — no private fields ───────────────────────────
const safeProfileUser = (user, postCount) => ({
  _id:            user._id,
  username:       user.username,
  fullName:       user.fullName,
  avatar:         user.avatar,
  bio:            user.bio,
  website:        user.website,
  location:       user.location,
  followersCount: user.followersCount || 0,
  followingCount: user.followingCount || 0,
  isVerified:     user.isVerified,
  isPrivate:      user.isPrivate,
  postCount:      postCount || 0,
  createdAt:      user.createdAt,
});

// ─── Get Profile ─────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const username = sanitizeString(req.params.username, 30)?.toLowerCase();

    // ✅ FIX: Resolve username → userId first, then use id-based cache key
    // This ensures follow/unfollow invalidation works correctly
    const userIdCache = await getCache(`user:username:${username}`);
    let userId = userIdCache;

    if (!userId) {
      const found = await User.findOne({ username, isSuspended: { $ne: true } }).select('_id').lean();
      if (!found) return res.status(404).json({ message: 'User not found' });
      userId = String(found._id);
      await setCache(`user:username:${username}`, userId, 300); // username→id TTL 5min
    }

    const cacheKey = `user:profile:id:${userId}`;
    let cached = await getCache(cacheKey);
    if (cached) {
      // Attach live isFollowing (not cached — user-specific)
      if (req.user) {
        const isFollowing = await Follow.exists({ followerId: req.user._id, followingId: userId });
        cached.isFollowing = !!isFollowing;
      }
      return res.json({ user: cached });
    }

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const postCount = await Post.countDocuments({ author: user._id, isPublic: true, isTakenDown: { $ne: true } });
    const profile   = safeProfileUser(user, postCount);

    if (req.user) {
      const isFollowing = await Follow.exists({ followerId: req.user._id, followingId: user._id });
      profile.isFollowing = !!isFollowing;
    }

    await setCache(cacheKey, profile, 60); // 60s TTL — safe for follower count drift
    res.json({ user: profile });
  } catch (err) {
    logger.error('Get profile failed', { error: err.message });
    res.status(500).json({ message: 'Failed to load profile.' });
  }
};

// ─── Get User Posts (cursor-paginated) ───────────────────────────────────────
exports.getUserPosts = async (req, res) => {
  try {
    const username = sanitizeString(req.params.username, 30)?.toLowerCase();
    const user = await User.findOne({ username }).select('_id').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);

    const posts = await Post.find({
      author: user._id,
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

    res.json({
      posts:      items,
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load posts.' });
  }
};

// ─── Update Profile ───────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, bio, website, location } = req.body;
    const user = await User.findById(req.user._id);

    if (fullName  !== undefined) user.fullName = sanitizeString(fullName,  50) || '';
    if (bio       !== undefined) user.bio      = sanitizeString(bio,     300) || '';
    if (location  !== undefined) user.location = sanitizeString(location,  50) || '';
    if (website   !== undefined) {
      const w = sanitizeString(website, 200) || '';
      user.website = (!w || w.startsWith('http://') || w.startsWith('https://')) ? w : '';
    }

    if (req.safeUpload) {
      if (user.avatarPublicId) {
        cloudinary.uploader.destroy(user.avatarPublicId).catch(() => {});
      }
      user.avatar         = req.safeUpload.url;
      user.avatarPublicId = req.safeUpload.publicId;
    }

    await user.save();
    await invalidateCache([
      `user:profile:id:${user._id}`,
      `user:username:${user.username}`,  // username→id mapping
    ]);
    res.json({ user: safeProfileUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Profile update failed.' });
  }
};

// ─── Toggle Follow (uses service) ────────────────────────────────────────────
exports.toggleFollow = async (req, res) => {
  try {
    const result = await followService.toggleFollow(req.user._id, req.params.id, req.app.get('io'));
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Follow action failed.' });
  }
};

// ─── Get Followers list (cursor-paginated) ────────────────────────────────────
exports.getFollowers = async (req, res) => {
  try {
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);
    const user = await User.findOne({ username: req.params.username }).select('_id').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const follows = await Follow.find({ followingId: user._id, ...cursorFilter })
      .sort(sort).limit(limit + 1)
      .populate('followerId', '_id username avatar fullName isVerified followersCount')
      .lean();

    const hasMore = follows.length > limit;
    const items   = hasMore ? follows.slice(0, limit) : follows;
    res.json({
      users:      items.map(f => f.followerId),
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load followers.' });
  }
};

// ─── Get Following list (cursor-paginated) ────────────────────────────────────
exports.getFollowing = async (req, res) => {
  try {
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);
    const user = await User.findOne({ username: req.params.username }).select('_id').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const follows = await Follow.find({ followerId: user._id, ...cursorFilter })
      .sort(sort).limit(limit + 1)
      .populate('followingId', '_id username avatar fullName isVerified followersCount')
      .lean();

    const hasMore = follows.length > limit;
    const items   = hasMore ? follows.slice(0, limit) : follows;
    res.json({
      users:      items.map(f => f.followingId),
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load following.' });
  }
};

// ─── Get Suggestions ──────────────────────────────────────────────────────────
exports.getSuggestions = async (req, res) => {
  try {
    // Get IDs already followed by user
    const following = await Follow.find({ followerId: req.user._id }).select('followingId').lean();
    const excludeIds = [req.user._id, ...following.map(f => f.followingId)];

    const suggestions = await User.find({
      _id: { $nin: excludeIds },
      isSuspended: { $ne: true },
    })
      .select('_id username avatar fullName followersCount isVerified')
      .sort({ followersCount: -1 })
      .limit(8)
      .lean();

    res.json({ users: suggestions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load suggestions.' });
  }
};

// ─── Get Saved Posts (cursor-paginated via service) ───────────────────────────
exports.getSavedPosts = async (req, res) => {
  try {
    const result = await saveService.getUserSavedPosts(req.user._id, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load saved posts.' });
  }
};
