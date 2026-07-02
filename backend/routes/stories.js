const express = require('express');
const router  = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { uploadStoryCoverImage } = require('../middleware/secureUpload');

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
} = require('../controllers/storyController');

// ─── Public routes (optional auth — draft check ke liye) ──────────────────────
router.get('/',              getStories);
router.get('/:storyId',      optionalAuth, getStory);
router.get('/user/:userId',  getUserStories);
router.get('/:storyId/comments', optionalAuth, getComments);
router.get('/:storyId/similar',  getSimilarStories);

// ─── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

router.post('/',                       uploadStoryCoverImage, createStory);
router.put('/:storyId',                uploadStoryCoverImage, updateStory);
router.delete('/:storyId',             deleteStory);

router.get('/my/stories',              getMyStories);
router.get('/my/bookmarks',            getMyBookmarks);
router.get('/my/reading-history',      getReadingHistory);

router.post('/:storyId/bookmark',      toggleBookmark);
router.post('/:storyId/progress',      saveProgress);

router.post('/:storyId/like',              toggleLike);
router.post('/:storyId/comment',           addComment);
router.delete('/:storyId/comment/:commentId', deleteComment);
router.post('/:storyId/comment/:commentId/like', toggleCommentLike);

module.exports = router;