const express = require('express');
const router  = express.Router();
const {
  createClub, getClubs, getClub, toggleMembership, getMyClubs, getClubPosts,
} = require('../controllers/clubController');
const { protect, optionalAuth } = require('../middleware/auth');
const { uploadClubCoverImage } = require('../middleware/secureUpload');
const { mongoIdValidation } = require('../middleware/validate');

// ─── Public ─────────────────────────────────────────────────────────────────
router.get('/',                     optionalAuth, getClubs);
router.get('/:clubId',              optionalAuth, ...mongoIdValidation('clubId'), getClub);
router.get('/:clubId/posts',        ...mongoIdValidation('clubId'), getClubPosts);

// ─── Protected ──────────────────────────────────────────────────────────────
router.use(protect);

router.post('/',                    uploadClubCoverImage, createClub);
router.get('/my/clubs',             getMyClubs);
router.post('/:clubId/membership',  ...mongoIdValidation('clubId'), toggleMembership);

module.exports = router;