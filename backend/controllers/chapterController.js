const Chapter         = require('../models/Chapter');
const Story            = require('../models/Story');
const Like             = require('../models/Like');
const Read             = require('../models/Read');
const Report            = require('../models/Report');
const { enqueueNotification } = require('../jobs/queues/notificationQueue');
const { cloudinary }   = require('../config/cloudinary');
const logger           = require('../utils/logger');
const { getCache, setCache } = require('../utils/cache');

// ─── Add Chapter ──────────────────────────────────────────────────────────────
exports.addChapter = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { title, content, contentType, isMature } = req.body;

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
        isMature:    isMature === true || isMature === 'true',
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
    const { title, content, contentType, status, isMature } = req.body;

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
    if (isMature !== undefined) chapter.isMature = isMature === true || isMature === 'true';
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

    // Mature content gate — author can always view their own chapter;
    // everyone else needs a confirmed 18+ account (fails closed if DOB is
    // missing/unset, which covers accounts created before DOB was required)
    const isAuthorViewing = req.user && String(chapter.author._id) === String(req.user._id);
    if (chapter.isMature && !isAuthorViewing && !req.user?.isAdult) {
      return res.status(403).json({
        message: 'This chapter contains mature content. Sign in with a verified 18+ account to view it.',
        code: 'MATURE_CONTENT_RESTRICTED',
      });
    }

    // Count the read once per reader, not on every refresh.
    // Logged-in: permanent dedup via the Read collection (unique index) —
    //   a duplicate create() throws 11000, which we simply swallow.
    // Logged-out: no stable identity, so we approximate with a 24h
    //   IP-based Redis key — good enough to stop refresh-spam.
    const isOwnChapter = req.user && String(chapter.author._id) === String(req.user._id);
    if (!isOwnChapter) {
      if (req.user) {
        try {
          await Read.create({ userId: req.user._id, targetType: 'Chapter', targetId: chapterId });
          await Chapter.findByIdAndUpdate(chapterId, { $inc: { totalReads: 1 } });
        } catch (err) {
          if (err.code !== 11000) throw err; // already read — don't recount
        }
      } else {
        const dedupKey = `read:chapter:${chapterId}:ip:${req.ip}`;
        const alreadyCounted = await getCache(dedupKey);
        if (!alreadyCounted) {
          await setCache(dedupKey, true, 24 * 60 * 60);
          await Chapter.findByIdAndUpdate(chapterId, { $inc: { totalReads: 1 } });
        }
      }
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

// ─── Report Chapter ──────────────────────────────────────────────────────────
exports.reportChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findOne({
      _id: req.params.chapterId,
      isDeleted: { $ne: true },
    }).select('_id');

    if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });

    const validReasons = [
      'spam', 'harassment', 'hate_speech', 'nudity_sexual_content',
      'violence', 'impersonation', 'copyright', 'inappropriate', 'other',
    ];
    const reason = validReasons.includes(req.body.reason) ? req.body.reason : 'other';
    const details = typeof req.body.details === 'string' ? req.body.details.slice(0, 500) : '';

    try {
      await Report.create({
        targetType: 'chapter',
        targetId: chapter._id,
        reason,
        details,
        reportedBy: req.user._id,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: 'You have already reported this chapter.' });
      }
      throw err;
    }

    await Chapter.findByIdAndUpdate(chapter._id, {
      $inc: { reportCount: 1 },
      $set: { isReported: true },
    });

    res.json({ message: 'Chapter reported. Our team will review it.' });
  } catch (err) {
    logger.error('reportChapter error', { error: err.message });
    res.status(500).json({ message: 'Failed to report chapter.' });
  }
};