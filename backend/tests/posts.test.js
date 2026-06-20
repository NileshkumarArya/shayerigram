const request = require('supertest');
const express = require('express');

process.env.JWT_SECRET = 'test_secret_key_for_jest_minimum_32_chars';
process.env.NODE_ENV   = 'test';

// ─── AUTH MIDDLEWARE MOCK ─────────────────────────────────────────────────────
// Real auth middleware verifies JWT and hits DB — not needed here.
// Inject a fixed user so protected routes pass without token validation.
jest.mock('../middleware/auth', () => ({
  protect: (req, _res, next) => {
    req.user = { _id: '507f191e810c19729de860ea', username: 'arya' };
    req.app.set('io', { to: () => ({ emit: jest.fn() }) });
    next();
  },
  optionalAuth: (req, _res, next) => {
    req.user = { _id: '507f191e810c19729de860ea', username: 'arya' };
    next();
  },
  adminOnly: (_req, _res, next) => next(),
}));

// ─── UPLOAD MIDDLEWARE MOCKS ──────────────────────────────────────────────────
// Bypass Cloudinary/multer entirely — no real file I/O in unit tests.
jest.mock('../middleware/secureUpload', () => ({
  uploadPostImage:     [],
  uploadPostImageFile: (req, res, next) => next(),
  processPostImage:    (req, res, next) => next(),
  multerErrorHandler:  (err, req, res, next) => next(err),
}));

// Quota check talks to Redis — skip it in tests.
jest.mock('../middleware/uploadQuota', () => ({
  checkUploadQuota: (req, res, next) => next(),
}));

// Abuse detection uses IP-based rate tracking — not relevant here.
jest.mock('../middleware/abuseDetection', () => ({
  checkAbuse: () => (req, res, next) => next(),
}));

// ─── MODEL MOCKS ─────────────────────────────────────────────────────────────
// All DB calls are mocked — tests run without a real MongoDB connection.

jest.mock('../models/Post', () => ({
  findById:        jest.fn(),
  findOne:         jest.fn(),
  create:          jest.fn(),
  // fire-and-forget calls use .catch() — must return a real Promise
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  countDocuments:  jest.fn(),
  find:            jest.fn().mockResolvedValue([]),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findById:          jest.fn(),
  // fire-and-forget counter increments use .catch() — must return a real Promise
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  find:              jest.fn().mockResolvedValue([]),
  updateMany:        jest.fn().mockResolvedValue({}),
}));

// Block list checked on every feed/post fetch to filter hidden content.
jest.mock('../models/Block', () => ({
  find: jest.fn().mockResolvedValue([]),
}));

jest.mock('../models/Notification', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../models/Report',       () => ({ findOne: jest.fn(), create: jest.fn() }));

// ─── EXTERNAL SERVICE MOCKS ───────────────────────────────────────────────────
// Cloudinary destroy is called on orphan cleanup — prevent real API calls.
jest.mock('cloudinary', () => ({ v2: { uploader: { destroy: jest.fn() } } }));

// ─── CACHE MOCK ───────────────────────────────────────────────────────────────
// Redis cache calls — return sensible defaults so controller logic flows through.
jest.mock('../utils/cache', () => ({
  getCache:       jest.fn().mockResolvedValue(null),
  setCache:       jest.fn().mockResolvedValue(),
  incrementCache: jest.fn().mockResolvedValue(1),
  decrementCache: jest.fn().mockResolvedValue(0),
  invalidateCache: jest.fn().mockResolvedValue(),
}));

// ─── SERVICE MOCKS ────────────────────────────────────────────────────────────
jest.mock('../services/likeService',    () => ({ toggleLike: jest.fn().mockResolvedValue({ liked: true }) }));
jest.mock('../services/saveService',    () => ({ toggleSave: jest.fn().mockResolvedValue({ saved: true }) }));
jest.mock('../services/commentService', () => ({
  addComment:  jest.fn().mockResolvedValue({ _id: 'cid', text: 'ok' }),
  deleteComment: jest.fn().mockResolvedValue({}),
  getComments: jest.fn().mockResolvedValue([]),
}));
jest.mock('../services/feedService', () => ({
  getFeed: jest.fn().mockResolvedValue({ posts: [], nextCursor: null }),
}));

// ─── APP SETUP ────────────────────────────────────────────────────────────────
const Post   = require('../models/Post');
const User   = require('../models/User');
const Report = require('../models/Report');

const app = express();
app.use(express.json());
app.use('/api/posts', require('../routes/posts'));

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe('Post routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates a text post', async () => {
    Post.create.mockResolvedValue({ _id: '507f191e810c19729de860eb' });
    // populate() is chained after findById — must return the final document
    Post.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id:    '507f191e810c19729de860eb',
        content: 'Hello world',
        author:  { _id: '507f191e810c19729de860ea', username: 'arya' },
      }),
    });

    const res = await request(app).post('/api/posts').send({ content: 'Hello world', category: 'Love' });
    expect(res.status).toBe(201);
  });

  test('rejects post with no content and no image', async () => {
    const res = await request(app).post('/api/posts').send({ category: 'Love' });
    expect(res.status).toBe(400);
  });

  test('rejects spammy comment', async () => {
    const res = await request(app)
      .post('/api/posts/507f191e810c19729de860eb/comment')
      .send({ text: 'free followers now' });
    expect(res.status).toBe(400);
  });

  test('reports a post with reason', async () => {
    // reportPost uses findOne().select() — needs a chainable mock
    Post.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: '507f191e810c19729de860eb' }),
    });
    Report.findOne.mockResolvedValue(null);
    Report.create.mockResolvedValue({ _id: '507f191e810c19729de860ec' });
    Post.findByIdAndUpdate.mockResolvedValue({ reportCount: 1, isTakenDown: false });
    User.findByIdAndUpdate.mockResolvedValue({});

    const res = await request(app)
      .post('/api/posts/507f191e810c19729de860eb/report')
      .send({ reason: 'spam', details: 'Repeated promotion' });

    expect(res.status).toBe(200);
    expect(Report.create).toHaveBeenCalled();
  });
});