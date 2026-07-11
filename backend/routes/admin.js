const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const {
  getReports, reviewReport, removePost, suspendUser, getStats,
  restorePost, hardDeletePost, softDeleteUser, getDeletedPosts, getAdminLogs,
  removeStory, restoreStory, hardDeleteStory, getDeletedStories,
  removeChapter, restoreChapter, hardDeleteChapter, getDeletedChapters,
  resolveDispute, getCopyrightStrikes,
} = require('../controllers/adminController');
const { mongoIdValidation } = require('../middleware/validate');

// All admin routes require auth + admin role
router.use(protect, adminOnly, adminLimiter); // Rate limit all admin actions

router.get  ('/stats',             getStats);
router.get  ('/reports',           getReports);
router.patch('/reports/:id',       ...mongoIdValidation('id'), reviewReport);
router.patch('/posts/:id/takedown',...mongoIdValidation('id'), removePost);
router.patch('/users/:id/suspend',       ...mongoIdValidation('id'), suspendUser);
router.patch('/users/:id/soft-delete',   ...mongoIdValidation('id'), softDeleteUser);
router.patch('/posts/:id/restore',       ...mongoIdValidation('id'), restorePost);
router.delete('/posts/:id/hard-delete',  ...mongoIdValidation('id'), hardDeletePost);
router.get('/posts/deleted',             getDeletedPosts);

router.patch('/stories/:id/takedown',    ...mongoIdValidation('id'), removeStory);
router.patch('/stories/:id/restore',     ...mongoIdValidation('id'), restoreStory);
router.delete('/stories/:id/hard-delete',...mongoIdValidation('id'), hardDeleteStory);
router.get('/stories/deleted',           getDeletedStories);

router.patch('/chapters/:id/takedown',    ...mongoIdValidation('id'), removeChapter);
router.patch('/chapters/:id/restore',     ...mongoIdValidation('id'), restoreChapter);
router.delete('/chapters/:id/hard-delete',...mongoIdValidation('id'), hardDeleteChapter);
router.get('/chapters/deleted',           getDeletedChapters);

router.get('/copyright-strikes', getCopyrightStrikes);
router.patch('/copyright-strikes/:id/resolve', ...mongoIdValidation('id'), resolveDispute);

router.get('/logs', getAdminLogs);
module.exports = router;
