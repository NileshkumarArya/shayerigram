const Chapter         = require('../models/Chapter');
const Story            = require('../models/Story');
const Like             = require('../models/Like');
const { enqueueNotification } = require('../jobs/queues/notificationQueue');
const { cloudinary }   = require('../config/cloudinary');
const logger           = require('../utils/logger');

// ─── Add Chapter ──────────────────────────────────────────────────────────────
exports.addChapter = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { title, content, contentType } = req.body;

    const story = await Story.findOne({ _id: storyId, author: req.user._id, isDeleted: false });
    if (!story) return res.status(404).json({ message: 'Story not found.' });

    // Atomic increment — guarantees each concurrent request gets a distinct
    // chapter number (two rapid "Add Chapter" clicks can no longer collide).
    const updatedStory = await Story.findByIdAndUpdate(
      storyId,
      { $inc: { totalChapters: 1 } },
      { new: true }
    );
    const nextChapterNumber = updatedStory.totalChapters;

    let chapter;
    try {
      chapter = await Chapter.create({
        story:       storyId,
        author:      req.user._id,
        title:       title.trim(),
        content:     content || '',
        chapterNumber: nextChapterNumber,
        contentType: contentType || 'text',
        status:      'draft',
      });
    } catch (createErr) {
      // Roll back the counter so it doesn't drift if chapter creation failed
      await Story.findByIdAndUpdate(storyId, { $inc: { totalChapters: -1 } });
      if (createErr.code === 11000) {
        return res.status(409).json({ message: 'That chapter number already exists. Please try again.' });
      }
      throw createErr;
    }

    // Audio — secureUpload middleware has already processed it
    if (req.safeCoverUpload) {
      chapter.coverImage         = req.safeCoverUpload.url;
      chapter.coverImagePublicId = req.safeCoverUpload.publicId;
    }
    if (req.safeAudioUpload) {
      chapter.audioUrl      = req.safeAudioUpload.url;
      chapter.audioPublicId = req.safeAudioUpload.publicId;
      chapter.audioDuration = req.safeAudioUpload.duration || 0;
    }
    if (req.safeCoverUpload || req.safeAudioUpload) {
      await chapter.save();
    }

    res.status(201).json({ success: true, chapter });
  } catch (err) {
    logger.error('addChapter error', { error: err.message });
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
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
    if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });

    if (title)       chapter.title       = title.trim();
    if (content !== undefined) chapter.content = content;
    if (contentType) chapter.contentType = contentType;
    if (status)       chapter.status      = status;
// Cover/audio update — secureUpload middleware has already processed these
    if (req.safeCoverUpload) {
      if (chapter.coverImagePublicId) {
        await cloudinary.uploader.destroy(chapter.coverImagePublicId).catch(() => {});
      }
      chapter.coverImage         = req.safeCoverUpload.url;
      chapter.coverImagePublicId = req.safeCoverUpload.publicId;
    }
    if (req.safeAudioUpload) {
      if (chapter.audioPublicId) {
        await cloudinary.uploader.destroy(chapter.audioPublicId, { resource_type: 'video' }).catch(() => {});
      }
      chapter.audioUrl      = req.safeAudioUpload.url;
      chapter.audioPublicId = req.safeAudioUpload.publicId;
      chapter.audioDuration = req.safeAudioUpload.duration || 0;
    }

    await chapter.save();
    res.json({ success: true, chapter });
  } catch (err) {
    logger.error('updateChapter error', { error: err.message });
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
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
    if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });

    chapter.isDeleted = true;
    await chapter.save();

    // Audio delete karo
    if (chapter.audioPublicId) {
      await cloudinary.uploader.destroy(chapter.audioPublicId, { resource_type: 'video' }).catch(() => {});
    }

    // Story ka totalChapters update karo
    await Story.findByIdAndUpdate(chapter.story, { $inc: { totalChapters: -1 } });

    res.json({ success: true, message: 'Chapter deleted.' });
  } catch (err) {
    logger.error('deleteChapter error', { error: err.message });
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// ─── Get Chapter (Reading mode) ───────────────────────────────────────────────
exports.getChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;

    const chapter = await Chapter.findOne({ _id: chapterId, isDeleted: false })
      .populate('author', 'username fullName avatar')
      .populate('story', 'title author status');

    if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });

    // Draft chapter sirf author dekh sakta hai
    if (chapter.status === 'draft' && String(chapter.author._id) !== String(req.user?._id)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Count the read unless the viewer is the chapter's own author.
    // Anonymous (logged-out) visitors should still count.
    if (!req.user || String(chapter.author._id) !== String(req.user._id)) {
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

    // ✅ NEW — tells the frontend if the current viewer already liked this chapter
    const isLiked = req.user
      ? !!(await Like.exists({ userId: req.user._id, targetType: 'Chapter', targetId: chapterId }))
      : false;

    res.json({ success: true, chapter, nextChapter, prevChapter, isLiked });
  } catch (err) {
    logger.error('getChapter error', { error: err.message });
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// ─── Get All Chapters of a Story ──────────────────────────────────────────────
exports.getChapters = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findOne({ _id: storyId, isDeleted: false });
    if (!story) return res.status(404).json({ message: 'Story not found.' });

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
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// ─── Reorder Chapters (drag-drop ke liye) ────────────────────────────────────
exports.reorderChapters = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { chapterOrder } = req.body; // Array of { chapterId, chapterNumber }

    const story = await Story.findOne({ _id: storyId, author: req.user._id, isDeleted: false });
    if (!story) return res.status(404).json({ message: 'Story not found.' });

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
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};


// ─── Toggle Chapter Like ─────────────────────────────────────────────────────
exports.toggleLike = async (req, res) => {
  try {
    const { chapterId } = req.params;

    const chapter = await Chapter.findOne({ _id: chapterId, isDeleted: false });
    if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });

    // Race-condition safe removal
    const removed = await Like.deleteOne({ userId: req.user._id, targetType: 'Chapter', targetId: chapterId });

    if (removed.deletedCount > 0) {
      const updated = await Chapter.findOneAndUpdate(
        { _id: chapterId, totalLikes: { $gt: 0 } },
        { $inc: { totalLikes: -1 } },
        { new: true }
      ).select('totalLikes');
      return res.json({ success: true, liked: false, totalLikes: Math.max(updated?.totalLikes || 0, 0) });
    }

    try {
      await Like.create({ userId: req.user._id, targetType: 'Chapter', targetId: chapterId });
    } catch (err) {
      if (err.code === 11000) {
        const current = await Chapter.findById(chapterId).select('totalLikes');
        return res.json({ success: true, liked: true, totalLikes: current?.totalLikes || 0 });
      }
      throw err;
    }

    const updated = await Chapter.findByIdAndUpdate(
      chapterId,
      { $inc: { totalLikes: 1 } },
      { new: true }
    ).select('author totalLikes story');

    // Notification points at the parent Story (Chapter isn't its own
    // notification entity type) so the writer still gets notified.
    if (updated && String(updated.author) !== String(req.user._id)) {
      enqueueNotification({
        recipientId: updated.author,
        actorId:     req.user._id,
        type:        'like',
        entityId:    updated.story,
        entityType:  'Story',
      }).catch(() => {});

      const io = req.app.get('io');
      if (io) {
        io.to(`notification_${updated.author}`).emit('notification', { type: 'like', chapterId });
      }
    }

    res.json({ success: true, liked: true, totalLikes: updated?.totalLikes || 0 });
  } catch (err) {
    logger.error('toggleChapterLike error', { error: err.message });
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};