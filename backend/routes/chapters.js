const express = require('express');
const router  = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { uploadChapterMedia }    = require('../middleware/secureUpload');

const {
  addChapter,
  updateChapter,
  deleteChapter,
  getChapter,
  getChapters,
  reorderChapters,
} = require('../controllers/chapterController');

// ─── Public routes ──────────────────────────────────────────────────────────────
router.get('/story/:storyId',     optionalAuth, getChapters);
router.get('/:chapterId',         optionalAuth, getChapter);

// ─── Protected routes ────────────────────────────────────────────────────────────
router.use(protect);

router.post('/story/:storyId',          uploadChapterMedia, addChapter);
router.put('/:chapterId',               uploadChapterMedia, updateChapter);
router.delete('/:chapterId',            deleteChapter);
router.put('/story/:storyId/reorder',   reorderChapters);

module.exports = router;