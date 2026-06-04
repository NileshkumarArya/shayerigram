const express = require('express');
const router  = express.Router();
const {
  getFeed, createPost, getPost, deletePost,
  toggleLike, addComment, deleteComment, getComments,
  toggleSave, getTrending, reportPost,
} = require('../controllers/postController');
const { protect, optionalAuth }  = require('../middleware/auth');
const {
  uploadPostImageFile,
  processPostImage,
  multerErrorHandler,
} = require('../middleware/secureUpload');
const { createPostValidation, commentValidation, mongoIdValidation } = require('../middleware/validate');
const { createPostLimiter, commentLimiter, likeLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { checkAbuse } = require('../middleware/abuseDetection');
const { checkUploadQuota } = require('../middleware/uploadQuota');

router.get('/feed',     protect,      getFeed);
router.get('/trending',               getTrending);

router.post('/',
  protect,
  createPostLimiter,
  uploadPostImageFile,
  multerErrorHandler,
  uploadLimiter,
  checkUploadQuota,
  processPostImage,
  createPostValidation,
  createPost
);

router.get('/:id',                   ...mongoIdValidation('id'), optionalAuth, getPost);
router.delete('/:id', protect,       ...mongoIdValidation('id'), deletePost);
router.post('/:id/like',    protect, likeLimiter, checkAbuse('like'),    ...mongoIdValidation('id'), toggleLike);
router.post('/:id/comment',                    protect, commentLimiter, checkAbuse('comment'), ...mongoIdValidation('id'), commentValidation, addComment);
router.post('/:id/comment/:commentId/reply',   protect, commentLimiter, checkAbuse('comment'), ...mongoIdValidation('id'), commentValidation, addComment);
router.delete('/:id/comment/:commentId', protect,
  ...mongoIdValidation('id'), ...mongoIdValidation('commentId'), deleteComment);
router.get('/:id/comments',          ...mongoIdValidation('id'), optionalAuth, getComments);
router.post('/:id/save',   protect,  ...mongoIdValidation('id'), toggleSave);
router.post('/:id/report', protect,  ...mongoIdValidation('id'), reportPost);

module.exports = router;