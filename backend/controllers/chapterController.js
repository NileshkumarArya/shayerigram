const Chapter         = require('../models/Chapter');
const Story            = require('../models/Story');
const { cloudinary }   = require('../config/cloudinary');
const logger           = require('../utils/logger');

// ─── Add Chapter ──────────────────────────────────────────────────────────────
exports.addChapter = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { title, content, contentType } = req.body;

    const story = await Story.findOne({ _id: storyId, author: req.user._id, isDeleted: false });
    if (!story) return res.status(404).json({ message: 'Story nahi mili.' });

    const nextChapterNumber = story.totalChapters + 1;

    const chapter = await Chapter.create({
      story:       storyId,
      author:      req.user._id,
      title:       title.trim(),
      content:     content || '',
      chapterNumber: nextChapterNumber,
      contentType: contentType || 'text',
      status:      'draft',
    });

    // Audio — secureUpload middleware ne already process kar diya hai
    if (req.safeUpload) {
      chapter.audioUrl      = req.safeUpload.url;
      chapter.audioPublicId = req.safeUpload.publicId;
      chapter.audioDuration = req.safeUpload.duration || 0;
      await chapter.save();
    }

    // Story ka totalChapters update karo
    await Story.findByIdAndUpdate(storyId, { $inc: { totalChapters: 1 } });

    res.status(201).json({ success: true, chapter });
  } catch (err) {
    logger.error('addChapter error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Update Chapter ───────────────────────────────────────────────────────────
exports.updateChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { title, content, contentType, status } = req.body;

    const chapter = await Chapter.findOne({
      _id:    chapterId,
      author: req.user._id,
      isDeleted: false,
    });
    if (!chapter) return res.status(404).json({ message: 'Chapter nahi mila.' });

    if (title)       chapter.title       = title.trim();
    if (content !== undefined) chapter.content = content;
    if (contentType) chapter.contentType = contentType;
    if (status)       chapter.status      = status;

    // Audio update — secureUpload middleware ne already process kar diya hai
    if (req.safeUpload) {
      if (chapter.audioPublicId) {
        await cloudinary.uploader.destroy(chapter.audioPublicId, { resource_type: 'video' }).catch(() => {});
      }
      chapter.audioUrl      = req.safeUpload.url;
      chapter.audioPublicId = req.safeUpload.publicId;
      chapter.audioDuration = req.safeUpload.duration || 0;
    }

    await chapter.save();
    res.json({ success: true, chapter });
  } catch (err) {
    logger.error('updateChapter error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Delete Chapter ───────────────────────────────────────────────────────────
exports.deleteChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;

    const chapter = await Chapter.findOne({
      _id:    chapterId,
      author: req.user._id,
      isDeleted: false,
    });
    if (!chapter) return res.status(404).json({ message: 'Chapter nahi mila.' });

    chapter.isDeleted = true;
    await chapter.save();

    // Audio delete karo
    if (chapter.audioPublicId) {
      await cloudinary.uploader.destroy(chapter.audioPublicId, { resource_type: 'video' }).catch(() => {});
    }

    // Story ka totalChapters update karo
    await Story.findByIdAndUpdate(chapter.story, { $inc: { totalChapters: -1 } });

    res.json({ success: true, message: 'Chapter delete ho gaya.' });
  } catch (err) {
    logger.error('deleteChapter error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Get Chapter (Reading mode) ───────────────────────────────────────────────
exports.getChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;

    const chapter = await Chapter.findOne({ _id: chapterId, isDeleted: false })
      .populate('author', 'username fullName avatar')
      .populate('story', 'title author status');

    if (!chapter) return res.status(404).json({ message: 'Chapter nahi mila.' });

    // Draft chapter sirf author dekh sakta hai
    if (chapter.status === 'draft' && String(chapter.author._id) !== String(req.user?._id)) {
      return res.status(403).json({ message: 'Access nahi hai.' });
    }

    // Read count increment (author khud na ho)
    if (req.user && String(chapter.author._id) !== String(req.user._id)) {
      await Chapter.findByIdAndUpdate(chapterId, { $inc: { totalReads: 1 } });
    }

    // Next/Previous chapter info
    const nextChapter = await Chapter.findOne({
      story:         chapter.story._id,
      chapterNumber: chapter.chapterNumber + 1,
      status:        'published',
      isDeleted:     false,
    }).select('_id title chapterNumber');

    const prevChapter = await Chapter.findOne({
      story:         chapter.story._id,
      chapterNumber: chapter.chapterNumber - 1,
      status:        'published',
      isDeleted:     false,
    }).select('_id title chapterNumber');

    res.json({ success: true, chapter, nextChapter, prevChapter });
  } catch (err) {
    logger.error('getChapter error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Get All Chapters of a Story ──────────────────────────────────────────────
exports.getChapters = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findOne({ _id: storyId, isDeleted: false });
    if (!story) return res.status(404).json({ message: 'Story nahi mili.' });

    const isAuthor = req.user && String(story.author) === String(req.user._id);
    const query = { story: storyId, isDeleted: false };

    // Non-author sirf published chapters dekh sakta hai
    if (!isAuthor) query.status = 'published';

    const chapters = await Chapter.find(query)
      .sort({ chapterNumber: 1 })
      .select('-content'); // List mein content nahi bhejna, sirf metadata

    res.json({ success: true, chapters });
  } catch (err) {
    logger.error('getChapters error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Reorder Chapters (drag-drop ke liye) ────────────────────────────────────
exports.reorderChapters = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { chapterOrder } = req.body; // Array of { chapterId, chapterNumber }

    const story = await Story.findOne({ _id: storyId, author: req.user._id, isDeleted: false });
    if (!story) return res.status(404).json({ message: 'Story nahi mili.' });

    const bulkOps = chapterOrder.map(({ chapterId, chapterNumber }) => ({
      updateOne: {
        filter: { _id: chapterId, story: storyId },
        update: { chapterNumber },
      },
    }));

    await Chapter.bulkWrite(bulkOps);

    res.json({ success: true, message: 'Chapters reorder ho gaye.' });
  } catch (err) {
    logger.error('reorderChapters error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};