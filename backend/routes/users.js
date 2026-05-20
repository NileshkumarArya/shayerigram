const express = require('express');
const router  = express.Router();
const {
  getProfile, getUserPosts, updateProfile, toggleFollow,
  getSuggestions, getSavedPosts, getFollowers, getFollowing,
} = require('../controllers/userController');
const { protect, optionalAuth }    = require('../middleware/auth');
const { uploadAvatarImage, multerErrorHandler } = require('../middleware/secureUpload');
const { updateProfileValidation, mongoIdValidation } = require('../middleware/validate');
const { followLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { checkAbuse } = require('../middleware/abuseDetection');

router.get('/suggestions', protect, getSuggestions);
router.get('/saved',       protect, getSavedPosts);

router.put('/profile',
  protect, uploadLimiter,
  ...uploadAvatarImage, multerErrorHandler,
  updateProfileValidation, updateProfile
);

router.post('/:id/follow',       protect, followLimiter, checkAbuse('follow'), ...mongoIdValidation('id'), toggleFollow);
router.get('/:username',         optionalAuth, getProfile);
router.get('/:username/posts',   optionalAuth, getUserPosts);
router.get('/:username/followers', optionalAuth, getFollowers);
router.get('/:username/following', optionalAuth, getFollowing);

module.exports = router;
