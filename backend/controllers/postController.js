/**
 * Post Controller — Thin controller, delegates to services
 */
const Post = require('../models/Post');
const User = require('../models/User');
const Report = require('../models/Report');
const Block = require('../models/Block');
const { getCache, setCache, invalidateCache } = require('../utils/cache');
const likeService = require('../services/likeService');
const saveService = require('../services/saveService');
const commentService = require('../services/commentService');
const feedService = require('../services/feedService');
const { enqueueNotification } = require('../jobs/queues/notificationQueue');
const logger = require('../utils/logger');

exports.getFeed = async (req, res) => {
  try {
    const result = await feedService.getFeed(req.user._id, req.query);
    res.json(result);
  } catch (err) {
    logger.error('Get feed failed', { error: err.message, userId: req.user._id });
    res.status(500).json({ message: 'Failed to load feed.' });
  }
};

exports.createPost = async (req, res) => {
  try {
    const { title, content, language, writtenIn, type, theme, fontStyle, clubId } = req.body;

    let categories = req.body['categories[]'] || req.body.categories;
    if (typeof categories === 'string') categories = [categories];
    if (!Array.isArray(categories) || categories.length === 0) categories = ['Other'];

    const postType = type || (req.safeUpload ? 'image' : 'text');

    if (postType === 'text' && !content?.trim()) {
      return res.status(400).json({ message: 'Please write your shayari' });
    }

    if (postType === 'image' && !req.safeUpload && !content?.trim()) {
      return res.status(400).json({ message: 'Please add an image or write your shayari' });
    }

    const postData = {
      author: req.user._id,
      title,
      content,
      categories,
      writtenIn: writtenIn || language || 'Hindi',
      type: postType,
      theme: theme || 'classic',
      fontStyle: fontStyle || 'shayari',
    };

    if (req.safeUpload) {
      postData.image = req.safeUpload.url;
      postData.imagePublicId = req.safeUpload.publicId;
      postData.type = 'image';
    }

    // Optional — post inside a club (must be a member)
    if (clubId) {
      const ClubMembership = require('../models/ClubMembership');
      const isMember = await ClubMembership.exists({ userId: req.user._id, clubId });
      if (!isMember) {
        return res.status(403).json({ message: 'Join the club before posting.' });
      }
      postData.clubId = clubId;
    } 

    const post = await Post.create(postData);

    if (clubId) {
      const Club = require('../models/Club');
      Club.findByIdAndUpdate(clubId, { $inc: { postsCount: 1 } }).catch(() => {});
    }

    User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } }).catch(() => {});

    const mentionRegex = /@([a-zA-Z0-9_.]+)/g;
    const safeContent = content || '';
    const mentionedUsernames = [...new Set(
      [...safeContent.matchAll(mentionRegex)].map(m => m[1].toLowerCase())
    )];

    if (mentionedUsernames.length > 0) {
      const [mentionedUsers, blocks] = await Promise.all([
        User.find({
          username: { $in: mentionedUsernames },
          isDeleted: { $ne: true },
          isSuspended: { $ne: true },
        })
          .select('_id username')
          .lean(),
        Block.find({
          $or: [
            { blockerId: req.user._id },
            { blockeeId: req.user._id },
          ],
        })
          .select('blockerId blockeeId')
          .lean(),
      ]);

      const blockedUserIds = new Set(
        blocks.map(b =>
          String(b.blockerId) === String(req.user._id)
            ? String(b.blockeeId)
            : String(b.blockerId)
        )
      );

      const notifyUsers = mentionedUsers.filter(u =>
        String(u._id) !== String(req.user._id) &&
        !blockedUserIds.has(String(u._id))
      );

      await Promise.all(
        notifyUsers.map(u => enqueueNotification({
          recipientId: u._id,
          actorId: req.user._id,
          type: 'mention',
          entityId: post._id,
        }).catch(() => {}))
      );

      const io = req.app.get('io');
      if (io) {
        notifyUsers.forEach(u => {
          io.to(`notification_${u._id}`).emit('notification', {
            type: 'mention',
            postId: post._id,
            actorId: req.user._id,
          });
        });
      }
    }

    await invalidateCache([
      `feed:first:${req.user._id}`,
      'trending:posts',
      'explore:all:first',
    ]);

    const populated = await Post.findById(post._id)
      .populate('author', '_id username avatar fullName isVerified')
      .lean();

    logger.info('Post created', { postId: post._id, userId: req.user._id });
    res.status(201).json({ post: populated });
  } catch (err) {
    logger.error('Create post failed', {
      error: err.message,
      code: err.code,
      name: err.name,
      userId: req.user?._id,
      content: req.body?.content?.slice(0, 50),
    });

    // Upload ho chuka tha but post create fail hua — Cloudinary orphan cleanup
    if (req.safeUpload?.publicId) {
      const cloudinary = require('cloudinary').v2;
      cloudinary.uploader.destroy(req.safeUpload.publicId).catch(() => {});
    }

    const msg = process.env.NODE_ENV !== 'production'
      ? `Failed to create post: ${err.message}`
      : 'Failed to create post.';

    res.status(500).json({ message: msg });
  }
};

exports.getPost = async (req, res) => {
  try {
    const cacheKey = `post:${req.params.id}`;
    let post = await getCache(cacheKey);

    if (!post) {
      post = await Post.findOne({
        _id: req.params.id,
        isDeleted: { $ne: true },
        isTakenDown: { $ne: true },
      })
        .populate('author', '_id username avatar fullName isVerified followersCount')
        .lean();

      if (!post) return res.status(404).json({ message: 'Post not found' });
      await setCache(cacheKey, post, 60);
    }

    if (req.user && post.author?._id && String(post.author._id) !== String(req.user._id)) {
      const isBlocked = await Block.exists({
        $or: [
          { blockerId: req.user._id, blockeeId: post.author._id },
          { blockerId: post.author._id, blockeeId: req.user._id },
        ],
      });

      if (isBlocked) return res.status(404).json({ message: 'Post not found' });
    }

    Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }).catch(() => {});

    let liked = false;
    let saved = false;

    if (req.user) {
      [liked, saved] = await Promise.all([
        likeService.isLiked(req.user._id, req.params.id),
        saveService.isSaved(req.user._id, req.params.id),
      ]);
    }

    res.json({ post: { ...post, liked, saved } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load post.' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findOneAndUpdate(
      {
        _id: req.params.id,
        author: req.user._id,
        isDeleted: { $ne: true },
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: req.user._id,
          isTakenDown: true,
        },
      },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.clubId) {
      const Club = require('../models/Club');
      Club.findOneAndUpdate(
        { _id: post.clubId, postsCount: { $gt: 0 } },
        { $inc: { postsCount: -1 } }
      ).catch(() => {});
    }

    User.findOneAndUpdate(
      { _id: req.user._id, postsCount: { $gt: 0 } },
      { $inc: { postsCount: -1 } }
    ).catch(() => {});

    await invalidateCache([
      `post:${req.params.id}`,
      `feed:first:${req.user._id}`,
      'trending:posts',
      'explore:all:first',
    ]);

    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete post.' });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const result = await likeService.toggleLike(
      req.user._id,
      req.params.id,
      req.user.username,
      req.app.get('io')
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Failed to toggle like.' });
  }
};

exports.addComment = async (req, res) => {
  try {
    const parentId = req.params.commentId || req.body.parentId || null;
    const result = await commentService.addComment(
      req.params.id,
      req.user._id,
      req.body.text,
      req.user.username,
      req.app.get('io'),
      parentId
    );

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Failed to add comment.' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const result = await commentService.deleteComment(
      req.params.commentId,
      req.user._id,
      req.params.id
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Failed to delete comment.' });
  }
};

exports.toggleCommentLike = async (req, res) => {
  try {
    const result = await commentService.toggleCommentLike(req.params.commentId, req.user._id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Failed to toggle comment like.' });
  }
};

exports.getComments = async (req, res) => {
  try {
    const result = await commentService.getComments(req.params.id, req.query, req.user?._id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Failed to load comments.' });
  }
};

exports.toggleSave = async (req, res) => {
  try {
    const result = await saveService.toggleSave(req.user._id, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Failed to toggle save.' });
  }
};

exports.getTrending = async (req, res) => {
  try {
    const cached = await getCache('trending:posts');
    if (cached) return res.json({ posts: cached, cached: true });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const posts = await Post.find({
      isPublic: true,
      isDeleted: { $ne: true },
      isTakenDown: { $ne: true },
      createdAt: { $gte: since },
    })
      .sort({ likesCount: -1, commentsCount: -1, views: -1, createdAt: -1 })
      .limit(20)
      .populate('author', '_id username avatar isVerified')
      .lean();

    const visiblePosts = posts.filter(p => p.author);

    await setCache('trending:posts', visiblePosts, 120);
    res.json({ posts: visiblePosts });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load trending.' });
  }
};

exports.reportPost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true },
      isTakenDown: { $ne: true },
    }).select('_id');

    if (!post) return res.status(404).json({ message: 'Post not found.' });

    const validReasons = ['spam', 'harassment', 'hate_speech', 'inappropriate', 'copyright', 'other'];
    const reason = validReasons.includes(req.body.reason) ? req.body.reason : 'other';
    const details = typeof req.body.details === 'string' ? req.body.details.slice(0, 500) : '';

    try {
      await Report.create({
        targetType: 'post',
        targetId: post._id,
        reason,
        details,
        reportedBy: req.user._id,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: 'You have already reported this post.' });
      }

      throw err;
    }

    await Post.findByIdAndUpdate(post._id, {
      $inc: { reportCount: 1 },
      $set: { isReported: true },
    });

    res.json({ message: 'Post reported. Our team will review it.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to report post.' });
  }
};