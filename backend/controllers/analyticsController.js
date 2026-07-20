const User            = require('../models/User');
const Post             = require('../models/Post');
const Story            = require('../models/Story');
const Chapter          = require('../models/Chapter');
const ReadingProgress  = require('../models/ReadingProgress');
const logger           = require('../utils/logger');

// Kitni posts+stories chahiye Analytics unlock karne ke liye
const MIN_CONTENT_FOR_ANALYTICS = 11;

exports.getMyAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;

    // Live counts — denormalized User.postsCount/storiesCount fields can drift
    // out of sync (e.g. posts created before that counter existed), so we
    // count the actual documents instead, same as ProfilePage does.
    //
    // Chapters count too, on top of posts+stories — a writer who publishes
    // 20 chapters inside one long story was previously stuck at "1 story"
    // toward this threshold forever, even though that's clearly a prolific,
    // active writer. Existing users lose nothing here since posts+stories
    // still count exactly as before; chapters are additive on top.
    const [totalPostsCount, totalStoriesCount, totalChaptersCount] = await Promise.all([
      Post.countDocuments({ author: userId, isDeleted: { $ne: true } }),
      Story.countDocuments({ author: userId, isDeleted: false }),
      Chapter.countDocuments({
        author: userId,
        isDeleted: { $ne: true },
        isTakenDown: { $ne: true },
        status: 'published',
      }),
    ]);
    const contentCount = totalPostsCount + totalStoriesCount + totalChaptersCount;

    if (contentCount < MIN_CONTENT_FOR_ANALYTICS) {
      return res.json({
        unlocked: false,
        progress: { current: contentCount, required: MIN_CONTENT_FOR_ANALYTICS },
      });
    }

    // ── Post aggregates ───────────────────────────────────────────────────
    const [postAgg] = await Post.aggregate([
      { $match: { author: userId, isDeleted: { $ne: true } } },
      { $group: {
        _id: null,
        likes:    { $sum: '$likesCount' },
        comments: { $sum: '$commentsCount' },
        saves:    { $sum: '$savesCount' },
        views:    { $sum: '$views' },
        count:    { $sum: 1 },
      } },
    ]);

    // ── Story aggregates ──────────────────────────────────────────────────
    const [storyAgg] = await Story.aggregate([
      { $match: { author: userId, isDeleted: false } },
      { $group: {
        _id: null,
        reads:     { $sum: '$totalReads' },
        likes:     { $sum: '$totalLikes' },
        comments:  { $sum: '$totalComments' },
        bookmarks: { $sum: '$totalBookmarks' },
        count:     { $sum: 1 },
      } },
    ]);

    const p = postAgg  || { likes: 0, comments: 0, saves: 0, views: 0, count: 0 };
    const s = storyAgg || { reads: 0, likes: 0, comments: 0, bookmarks: 0, count: 0 };

    const engagementNumerator   = p.likes + p.comments * 2 + s.likes + s.comments * 2;
    const engagementDenominator = Math.max(p.views + s.reads, 1);
    const engagementRate = Math.round((engagementNumerator / engagementDenominator) * 1000) / 10; // %

    // ── Top 5 posts / stories ────────────────────────────────────────────────
    const topPosts = await Post.find({ author: userId, isDeleted: { $ne: true } })
      .select('_id title content image likesCount commentsCount views createdAt')
      .sort({ likesCount: -1 })
      .limit(5)
      .lean();

    const topStories = await Story.find({ author: userId, isDeleted: false })
      .select('_id title coverImage totalReads totalLikes totalComments genre')
      .sort({ totalReads: -1 })
      .limit(5)
      .lean();

    // ── Chapter drop-off funnel — top 3 stories by reads ────────────────────
    const storyDropoff = [];
    for (const story of topStories.slice(0, 3)) {
      const chapters = await Chapter.find({
        story: story._id, status: 'published', isDeleted: { $ne: true },
      }).select('chapterNumber title').sort({ chapterNumber: 1 }).lean();
      if (chapters.length === 0) continue;

      const progress = await ReadingProgress.find({ story: story._id })
        .select('lastChapterNumber').lean();

      const funnel = chapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        readersReached: progress.filter(pr => pr.lastChapterNumber >= ch.chapterNumber).length,
      }));

      storyDropoff.push({ storyId: story._id, title: story.title, funnel });
    }

    res.json({
      unlocked: true,
      overview: {
        totalPosts:          p.count,
        totalStories:        s.count,
        totalPostLikes:      p.likes,
        totalPostComments:   p.comments,
        totalPostSaves:      p.saves,
        totalPostViews:      p.views,
        totalStoryReads:     s.reads,
        totalStoryLikes:     s.likes,
        totalStoryComments:  s.comments,
        totalStoryBookmarks: s.bookmarks,
        engagementRate,
      },
      topPosts,
      topStories,
      storyDropoff,
    });
  } catch (err) {
    logger.error('getMyAnalytics error', { error: err.message });
    res.status(500).json({ message: 'Failed to load analytics.' });
  }
};