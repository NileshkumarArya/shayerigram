const Story          = require('../models/Story');
const Chapter        = require('../models/Chapter');
const Bookmark       = require('../models/Bookmark');
const ReadingProgress = require('../models/ReadingProgress');
const { cloudinary } = require('../config/cloudinary');
const logger         = require('../utils/logger');

// ─── Create Story ─────────────────────────────────────────────────────────────
exports.createStory = async (req, res) => {
  try {
    const { title, description, genre, tags, language, contentType } = req.body;

    const story = await Story.create({
      author:      req.user._id,
      title:       title.trim(),
      description: description?.trim() || '',
      genre:       genre || 'Other',
      tags:        tags ? JSON.parse(tags) : [],
      language:    language || 'hindi',
      contentType: contentType || 'text',
      status:      'draft',
    });

   // Cover image — secureUpload middleware ne already process kar diya hai
    if (req.safeUpload) {
      story.coverImage         = req.safeUpload.url;
      story.coverImagePublicId = req.safeUpload.publicId;
      await story.save();
    }

    // User ka storiesCount update karo
    await req.user.constructor.findByIdAndUpdate(req.user._id, {
      $inc: { storiesCount: 1 },
    });

    res.status(201).json({ success: true, story });
  } catch (err) {
    logger.error('createStory error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Update Story ─────────────────────────────────────────────────────────────
exports.updateStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { title, description, genre, tags, language, contentType, status } = req.body;

    const story = await Story.findOne({ _id: storyId, author: req.user._id, isDeleted: false });
    if (!story) return res.status(404).json({ message: 'Story nahi mili.' });

    if (title)       story.title       = title.trim();
    if (description) story.description = description.trim();
    if (genre)       story.genre       = genre;
    if (language)    story.language    = language;
    if (contentType) story.contentType = contentType;
    if (tags)        story.tags        = JSON.parse(tags);

    // Sirf draft → published allowed hai
    if (status && story.totalChapters > 0) {
      story.status = status;
    }

    // Cover image update — secureUpload middleware ne already process kar diya hai
    if (req.safeUpload) {
      // Purana image delete karo
      if (story.coverImagePublicId) {
        await cloudinary.uploader.destroy(story.coverImagePublicId).catch(() => {});
      }
      story.coverImage         = req.safeUpload.url;
      story.coverImagePublicId = req.safeUpload.publicId;
    }

    await story.save();
    res.json({ success: true, story });
  } catch (err) {
    logger.error('updateStory error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Delete Story ─────────────────────────────────────────────────────────────
exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findOne({ _id: storyId, author: req.user._id, isDeleted: false });
    if (!story) return res.status(404).json({ message: 'Story nahi mili.' });

    // Soft delete
    story.isDeleted = true;
    story.deletedAt = new Date();
    await story.save();

    // Cover image delete karo
    if (story.coverImagePublicId) {
      await cloudinary.uploader.destroy(story.coverImagePublicId).catch(() => {});
    }

    // User ka storiesCount update karo
    await req.user.constructor.findByIdAndUpdate(req.user._id, {
      $inc: { storiesCount: -1 },
    });

    res.json({ success: true, message: 'Story delete ho gayi.' });
  } catch (err) {
    logger.error('deleteStory error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Get Single Story ─────────────────────────────────────────────────────────
exports.getStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findOne({ _id: storyId, isDeleted: false })
      .populate('author', 'username fullName avatar isVerified');

    if (!story) return res.status(404).json({ message: 'Story nahi mili.' });

    // Draft story sirf author dekh sakta hai
    if (story.status === 'draft' && String(story.author._id) !== String(req.user?._id)) {
      return res.status(403).json({ message: 'Access nahi hai.' });
    }

    // Read count increment (author khud na ho)
    if (req.user && String(story.author._id) !== String(req.user._id)) {
      await Story.findByIdAndUpdate(storyId, { $inc: { totalReads: 1 } });
    }

    // Reading progress fetch karo
    let progress = null;
    if (req.user) {
      progress = await ReadingProgress.findOne({
        user:  req.user._id,
        story: storyId,
      }).populate('lastChapter', 'title chapterNumber');
    }

    // Bookmark check karo
    let isBookmarked = false;
    if (req.user) {
      const bookmark = await Bookmark.findOne({ user: req.user._id, story: storyId });
      isBookmarked = !!bookmark;
    }

    res.json({ success: true, story, progress, isBookmarked });
  } catch (err) {
    logger.error('getStory error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Get All Stories (Feed) ───────────────────────────────────────────────────
exports.getStories = async (req, res) => {
  try {
    const { genre, language, page = 1, limit = 20, sort = 'latest' } = req.query;

    const query = { status: 'published', isDeleted: false };
    if (genre)    query.genre    = genre;
    if (language) query.language = language;

    const sortOptions = {
      latest:   { createdAt: -1 },
      trending: { totalReads: -1 },
      popular:  { totalLikes: -1 },
    };

    const stories = await Story.find(query)
      .populate('author', 'username fullName avatar isVerified')
      .sort(sortOptions[sort] || sortOptions.latest)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-coverImagePublicId');

    const total = await Story.countDocuments(query);

    res.json({
      success: true,
      stories,
      hasMore: parseInt(page) * parseInt(limit) < total,
      total,
    });
  } catch (err) {
    logger.error('getStories error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Get My Stories ───────────────────────────────────────────────────────────
exports.getMyStories = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { author: req.user._id, isDeleted: false };
    if (status) query.status = status;

    const stories = await Story.find(query)
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-coverImagePublicId');

    res.json({ success: true, stories });
  } catch (err) {
    logger.error('getMyStories error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Get User Stories (Profile) ───────────────────────────────────────────────
exports.getUserStories = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const stories = await Story.find({
      author:    userId,
      status:    'published',
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-coverImagePublicId');

    res.json({ success: true, stories });
  } catch (err) {
    logger.error('getUserStories error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Toggle Bookmark ──────────────────────────────────────────────────────────
exports.toggleBookmark = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findOne({ _id: storyId, isDeleted: false });
    if (!story) return res.status(404).json({ message: 'Story nahi mili.' });

    const existing = await Bookmark.findOne({ user: req.user._id, story: storyId });

    if (existing) {
      await existing.deleteOne();
      await Story.findByIdAndUpdate(storyId, { $inc: { totalBookmarks: -1 } });
      return res.json({ success: true, isBookmarked: false });
    }

    await Bookmark.create({ user: req.user._id, story: storyId });
    await Story.findByIdAndUpdate(storyId, { $inc: { totalBookmarks: 1 } });

    res.json({ success: true, isBookmarked: true });
  } catch (err) {
    logger.error('toggleBookmark error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Get My Bookmarks ─────────────────────────────────────────────────────────
exports.getMyBookmarks = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const bookmarks = await Bookmark.find({ user: req.user._id })
      .populate({
        path:   'story',
        match:  { isDeleted: false, status: 'published' },
        populate: { path: 'author', select: 'username fullName avatar' },
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const stories = bookmarks
      .filter(b => b.story)
      .map(b => b.story);

    res.json({ success: true, stories });
  } catch (err) {
    logger.error('getMyBookmarks error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Save Reading Progress ────────────────────────────────────────────────────
exports.saveProgress = async (req, res) => {
  try {
    const { storyId }                                  = req.params;
    const { chapterId, chapterNumber, scrollPosition, isCompleted } = req.body;

    const progress = await ReadingProgress.findOneAndUpdate(
      { user: req.user._id, story: storyId },
      {
        lastChapter:       chapterId,
        lastChapterNumber: chapterNumber,
        scrollPosition:    scrollPosition || 0,
        isCompleted:       isCompleted || false,
        lastReadAt:        new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, progress });
  } catch (err) {
    logger.error('saveProgress error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Get Reading History ──────────────────────────────────────────────────────
exports.getReadingHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const history = await ReadingProgress.find({ user: req.user._id })
      .populate({
        path:     'story',
        match:    { isDeleted: false },
        populate: { path: 'author', select: 'username fullName avatar' },
      })
      .populate('lastChapter', 'title chapterNumber')
      .sort({ lastReadAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const filtered = history.filter(h => h.story);

    res.json({ success: true, history: filtered });
  } catch (err) {
    logger.error('getReadingHistory error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};