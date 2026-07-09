const express = require('express');
const router  = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { uploadChapterMedia }    = require('../middleware/secureUpload');
const { mongoIdValidation }     = require('../middleware/validate');
const { likeLimiter }           = require('../middleware/rateLimiter');
const { checkAbuse }            = require('../middleware/abuseDetection');

const {
  addChapter,
  updateChapter,
  deleteChapter,
  getChapter,
  getChapters,
  reorderChapters,
  toggleLike,
  reportChapter,
} = require('../controllers/chapterController');

// ─── Public routes ──────────────────────────────────────────────────────────────
router.get('/story/:storyId',     ...mongoIdValidation('storyId'), optionalAuth, getChapters);
router.get('/:chapterId',         ...mongoIdValidation('chapterId'), optionalAuth, getChapter);

// ─── Protected routes ────────────────────────────────────────────────────────────
router.use(protect);

router.post('/story/:storyId',          ...mongoIdValidation('storyId'), uploadChapterMedia, addChapter);
router.put('/:chapterId',               ...mongoIdValidation('chapterId'), uploadChapterMedia, updateChapter);
router.delete('/:chapterId',            ...mongoIdValidation('chapterId'), deleteChapter);
router.put('/story/:storyId/reorder',   ...mongoIdValidation('storyId'), reorderChapters);
router.post('/:chapterId/like',         likeLimiter, checkAbuse('like'), ...mongoIdValidation('chapterId'), toggleLike);
router.post('/:chapterId/report',       ...mongoIdValidation('chapterId'), reportChapter);

module.exports = router;