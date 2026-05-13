const express = require('express');
const router  = express.Router();
const {
  search, getAllPosts, getByCategory, getByHashtag, getTrending,
} = require('../controllers/exploreController');
const { searchValidation }  = require('../middleware/validate');
const { searchLimiter }     = require('../middleware/rateLimiter');

// ✅ Safe import — avoid crash if auth not fully exported
let protect = (req, res, next) => next();
let optionalAuth = (req, res, next) => next();

try {
  const authMw = require('../middleware/auth');
  if (authMw.protect)      protect      = authMw.protect;
  if (authMw.optionalAuth) optionalAuth = authMw.optionalAuth;
} catch (err) {
  console.error('[explore routes] auth import failed:', err.message);
}

router.get('/search',             searchLimiter, searchValidation, search);
router.get('/trending',                          getTrending);
router.get('/all',                optionalAuth,  getAllPosts);
router.get('/category/:category', optionalAuth,  getByCategory);
router.get('/hashtag/:tag',       optionalAuth,  getByHashtag);

module.exports = router;
