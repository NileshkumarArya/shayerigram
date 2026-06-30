const express = require('express');
const router  = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { uploadChapterAudio }    = require('../middleware/secureUpload');

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

router.post('/story/:storyId',          uploadChapterAudio, addChapter);
router.put('/:chapterId',               uploadChapterAudio, updateChapter);
router.delete('/:chapterId',            deleteChapter);
router.put('/story/:storyId/reorder',   reorderChapters);

module.exports = router;