/**
 * User Controller — thin, delegates to services
 * All follow/save/profile logic uses separate collections
 */
const User         = require('../models/User');
const Post         = require('../models/Post');
const Follow       = require('../models/Follow');
const Like         = require('../models/Like');
const Save         = require('../models/Save');
const Block        = require('../models/Block');
const followService = require('../services/followService');
const saveService   = require('../services/saveService');
const { getCache, setCache, invalidateCache } = require('../utils/cache');
const { buildCursorPagination, encodeCursor } = require('../utils/pagination');
const { sanitizeString } = require('../middleware/security');
const cloudinary   = require('cloudinary').v2;
const logger       = require('../utils/logger');

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

const getBlockedUserIds = async (userId) => {
  if (!userId) return [];
  const blocks = await Block.find({
    $or: [{ blockerId: userId }, { blockeeId: userId }],
  }).select('blockerId blockeeId').lean();
  return blocks.map(b =>
    String(b.blockerId) === String(userId) ? b.blockeeId : b.blockerId
  );
};

exports.getProfile = async (req, res) => {
  try {
    const username = sanitizeString(req.params.username, 30)?.toLowerCase();

    const userIdCache = await getCache(`user:username:${username}`);
    let userId = userIdCache;

    if (!userId) {
      const found = await User.findOne({
        username,
        isSuspended: { $ne: true },
        isDeleted:   { $ne: true },
      }).select('_id').lean();
      if (!found) return res.status(404).json({ message: 'User not found' });
      userId = String(found._id);
      await setCache(`user:username:${username}`, userId, 300);
    }

    if (req.user && String(req.user._id) !== String(userId)) {
      const blocked = await Block.exists({
        $or: [
          { blockerId: req.user._id, blockeeId: userId },
          { blockerId: userId, blockeeId: req.user._id },
        ],
      });
      if (blocked) return res.status(404).json({ message: 'User not found' });
    }

    const cacheKey = `user:profile:id:${userId}`;
    let cached = await getCache(cacheKey);
    if (cached) {
      if (req.user) {
        const isFollowing = await Follow.exists({ followerId: req.user._id, followingId: userId });
        cached.isFollowing = !!isFollowing;
      }
      return res.json({ user: cached });
    }

    const user = await User.findOne({
      _id:         userId,
      isSuspended: { $ne: true },
      isDeleted:   { $ne: true },
    }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const postCount = await Post.countDocuments({
      author: user._id,
      isPublic: true,
      isDeleted: { $ne: true },
      isTakenDown: { $ne: true },
    });

    // Use the denormalized counters already sitting on the User document —
    // no need to scan every Follow relation just to count them. On Atlas M0
    // (~100 ops/sec budget), this alone could burn a real chunk of it for
    // anyone with a sizeable following, on a single profile view.
    const profile = safeProfileUser(user, postCount);

    if (req.user) {
      const isFollowing = await Follow.exists({ followerId: req.user._id, followingId: user._id });
      profile.isFollowing = !!isFollowing;
    }

    await setCache(cacheKey, profile, 60);
    res.json({ user: profile });
  } catch (err) {
    logger.error('Get profile failed', { error: err.message });
    res.status(500).json({ message: 'Failed to load profile.' });
  }
};

exports.getUserPosts = async (req, res) => {
  try {
    const username = sanitizeString(req.params.username, 30)?.toLowerCase();
    const user = await User.findOne({
      username,
      isSuspended: { $ne: true },
      isDeleted:   { $ne: true },
    }).select('_id').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.user && String(req.user._id) !== String(user._id)) {
      const blocked = await Block.exists({
        $or: [
          { blockerId: req.user._id, blockeeId: user._id },
          { blockerId: user._id, blockeeId: req.user._id },
        ],
      });
      if (blocked) return res.status(404).json({ message: 'User not found' });
    }

    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);
    const posts = await Post.find({
      author: user._id,
      isPublic: true,
      isDeleted: { $ne: true },
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
      `user:username:${user.username}`,
    ]);
    res.json({ user: safeProfileUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Profile update failed.' });
  }
};

exports.toggleFollow = async (req, res) => {
  try {
    const result = await followService.toggleFollow(req.user._id, req.params.id, req.app.get('io'));
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Follow action failed.' });
  }
};

exports.getFollowers = async (req, res) => {
  try {
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);
    const username = sanitizeString(req.params.username, 30)?.toLowerCase();
    const user = await User.findOne({
      username,
      isSuspended: { $ne: true },
      isDeleted:   { $ne: true },
    }).select('_id').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const blockedUserIds = await getBlockedUserIds(req.user?._id);

    if (req.user && String(req.user._id) !== String(user._id)) {
      const blocked = blockedUserIds.some(id => String(id) === String(user._id));
      if (blocked) return res.status(404).json({ message: 'User not found' });
    }

    const follows = await Follow.find({ followingId: user._id, ...cursorFilter })
      .sort(sort).limit(limit + 1)
      .populate({
        path: 'followerId',
        select: '_id username avatar fullName isVerified followersCount',
        match: {
          isDeleted:   { $ne: true },
          isSuspended: { $ne: true },
          // ✅ FIX: blocked users followers list se hide honge
          ...(blockedUserIds.length ? { _id: { $nin: blockedUserIds } } : {}),
        },
      })
      .lean();

    const hasMore = follows.length > limit;
    const items   = hasMore ? follows.slice(0, limit) : follows;
    const users   = items.map(f => f.followerId).filter(Boolean);
    res.json({
      users,
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load followers.' });
  }
};

exports.getFollowing = async (req, res) => {
  try {
    const { filter: cursorFilter, sort, limit } = buildCursorPagination(req.query);
    const username = sanitizeString(req.params.username, 30)?.toLowerCase();
    const user = await User.findOne({
      username,
      isSuspended: { $ne: true },
      isDeleted:   { $ne: true },
    }).select('_id').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const blockedUserIds = await getBlockedUserIds(req.user?._id);

    if (req.user && String(req.user._id) !== String(user._id)) {
      const blocked = blockedUserIds.some(id => String(id) === String(user._id));
      if (blocked) return res.status(404).json({ message: 'User not found' });
    }

    const follows = await Follow.find({ followerId: user._id, ...cursorFilter })
      .sort(sort).limit(limit + 1)
      .populate({
        path: 'followingId',
        select: '_id username avatar fullName isVerified followersCount',
        match: {
          isDeleted:   { $ne: true },
          isSuspended: { $ne: true },
          // ✅ FIX: blocked users following list se hide honge
          ...(blockedUserIds.length ? { _id: { $nin: blockedUserIds } } : {}),
        },
      })
      .lean();

    const hasMore = follows.length > limit;
    const items   = hasMore ? follows.slice(0, limit) : follows;
    const users   = items.map(f => f.followingId).filter(Boolean);
    res.json({
      users,
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load following.' });
  }
};

exports.getSuggestions = async (req, res) => {
  try {
    const [following, blockedUserIds] = await Promise.all([
      Follow.find({ followerId: req.user._id }).select('followingId').lean(),
      getBlockedUserIds(req.user._id),
    ]);
    const excludeIds = [req.user._id, ...following.map(f => f.followingId), ...blockedUserIds];
    const suggestions = await User.find({
      _id: { $nin: excludeIds },
      isSuspended: { $ne: true },
      isDeleted:   { $ne: true },
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

exports.getSavedPosts = async (req, res) => {
  try {
    const result = await saveService.getUserSavedPosts(req.user._id, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load saved posts.' });
  }
};