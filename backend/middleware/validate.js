const { body, param, query, validationResult } = require('express-validator');

// ─── Validation Error Handler ─────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Auth Validations ─────────────────────────────────────────────────────
const registerValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_.]+$/).withMessage('Username can only contain letters, numbers, _ and .'),
  body('email')
    .trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
    .isLength({ max: 254 }).withMessage('Email too long'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 72 }).withMessage('Password must be 8-72 characters'),
  body('fullName')
    .optional().trim()
    .isLength({ max: 50 }).withMessage('Full name too long')
    .escape(),
  body('acceptTerms')
    .custom(value => value === true || value === 'true')
    .withMessage('You must accept the Terms and Community Guidelines'),
  validate,
];

const loginValidation = [
  body('identifier')
    .trim().notEmpty().withMessage('Email or username is required')
    .isLength({ max: 254 }).withMessage('Too long'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 72 }).withMessage('Invalid password'),
  validate,
];

// ─── Password Reset Validations ───────────────────────────────────────────
const forgotPasswordValidation = [
  body('email')
    .trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email').normalizeEmail(),
  validate,
];

const resetPasswordValidation = [
  body('token').trim().notEmpty().withMessage('Token is required'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 72 }).withMessage('Password must be 8-72 characters'),
  validate,
];

// ─── Post Validations ─────────────────────────────────────────────────────
const createPostValidation = [
  body('content')
    .optional({ checkFalsy: true }).trim()  // ✅ optional for image-only posts
    .isLength({ max: 2000 }).withMessage('Content max 2000 characters'),
  body('title')
    .optional().trim().isLength({ max: 100 }).withMessage('Title too long'),
  // ✅ categories is optional — controller handles 'categories[]' FormData arrays
  // Validation here is relaxed because multer parses multipart differently
  body('categories').optional(),
  body('categories[]').optional(),
  body('language')
    .optional()
    .isIn(['Hindi', 'Urdu', 'English', 'Mixed']).withMessage('Invalid language'),
  body('type')
    .optional()
    .isIn(['text', 'image']).withMessage('Invalid post type'),
  validate,
];

// ─── Comment Validation with spam check ──────────────────────────────────
const SPAM_PATTERNS = [
  /free followers/i, /click here/i, /bit\.ly/i, /tinyurl/i,
  /www\./i, /https?:\/\//i, /promo code/i,
];

const commentValidation = [
  body('text')
    .trim().notEmpty().withMessage('Comment cannot be empty')
    .isLength({ min: 1, max: 500 }).withMessage('Comment must be 1-500 characters')
    .custom((val) => {
      if (SPAM_PATTERNS.some(p => p.test(val))) {
        throw new Error('Comment contains disallowed content.');
      }
      return true;
    }),
  validate,
];

// ─── Profile Validation ───────────────────────────────────────────────────
const updateProfileValidation = [
  body('fullName').optional().trim().isLength({ max: 50 }).withMessage('Full name too long'),
  body('bio').optional().trim().isLength({ max: 300 }).withMessage('Bio max 300 characters'),
  body('website')
    .optional({ checkFalsy: true }).trim()  // ✅ skip empty string
    .isURL({ require_protocol: true, protocols: ['http', 'https'] }).withMessage('Invalid website URL')
    .isLength({ max: 200 }),
  body('location').optional().trim().isLength({ max: 50 }).withMessage('Location too long'),
  validate,
];

// ─── Search Validation ────────────────────────────────────────────────────
const searchValidation = [
  query('q')
    .optional().trim()
    .isLength({ min: 1, max: 50 }).withMessage('Search query must be 1-50 characters')
    .matches(/^[a-zA-Z0-9\u0900-\u097F\u0600-\u06FF\s#@_.,-]+$/).withMessage('Invalid search characters'),
  query('type')
    .optional()
    .isIn(['all', 'posts', 'users']).withMessage('Invalid search type'),
  validate,
];

// ─── MongoDB ObjectId Validation ──────────────────────────────────────────
const mongoIdValidation = (paramName) => [
  param(paramName).matches(/^[a-f0-9]{24}$/).withMessage('Invalid ID format'),
  validate,
];

// ─── Single exports block — all validators defined above ─────────────────
module.exports = {
  validate,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  createPostValidation,
  commentValidation,
  updateProfileValidation,
  searchValidation,
  mongoIdValidation,
};
