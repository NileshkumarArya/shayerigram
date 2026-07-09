const express = require('express');
const router  = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { uploadStoryCoverImage } = require('../middleware/secureUpload');
const { mongoIdValidation, commentValidation } = require('../middleware/validate');
const { likeLimiter, commentLimiter } = require('../middleware/rateLimiter');
const { checkAbuse } = require('../middleware/abuseDetection');

const {
  createStory,
  updateStory,
  deleteStory,
  getStory,
  getStories,
  getMyStories,
  getUserStories,
  toggleBookmark,
  getMyBookmarks,
  saveProgress,
  getReadingHistory,
  toggleLike,
  addComment,
  deleteComment,
  getComments,
  getSimilarStories,
  toggleCommentLike,
  reportStory,
} = require('../controllers/storyController');

// ─── Public routes (optional auth — draft check ke liye) ──────────────────────
router.get('/',              getStories);
router.get('/:storyId',      ...mongoIdValidation('storyId'), optionalAuth, getStory);
router.get('/user/:userId',  ...mongoIdValidation('userId'), getUserStories);
router.get('/:storyId/comments', ...mongoIdValidation('storyId'), optionalAuth, getComments);
router.get('/:storyId/similar',  ...mongoIdValidation('storyId'), getSimilarStories);

// ─── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

router.post('/',                       uploadStoryCoverImage, createStory);
router.put('/:storyId',                ...mongoIdValidation('storyId'), uploadStoryCoverImage, updateStory);
router.delete('/:storyId',             ...mongoIdValidation('storyId'), deleteStory);

router.get('/my/stories',              getMyStories);
router.get('/my/bookmarks',            getMyBookmarks);
router.get('/my/reading-history',      getReadingHistory);

router.post('/:storyId/bookmark',      ...mongoIdValidation('storyId'), toggleBookmark);
router.post('/:storyId/progress',      ...mongoIdValidation('storyId'), saveProgress);

router.post('/:storyId/like',              likeLimiter, checkAbuse('like'), ...mongoIdValidation('storyId'), toggleLike);
router.post('/:storyId/comment',           commentLimiter, checkAbuse('comment'), ...mongoIdValidation('storyId'), commentValidation, addComment);
router.delete('/:storyId/comment/:commentId', ...mongoIdValidation('storyId'), ...mongoIdValidation('commentId'), deleteComment);
router.post('/:storyId/comment/:commentId/like', likeLimiter, ...mongoIdValidation('storyId'), ...mongoIdValidation('commentId'), toggleCommentLike);
router.post('/:storyId/report',            ...mongoIdValidation('storyId'), reportStory);

module.exports = router;