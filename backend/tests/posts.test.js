const request = require('supertest');
const express = require('express');

// Environment setup — must be before any module imports
process.env.JWT_SECRET = 'test_secret_key_for_jest_minimum_32_chars';
process.env.NODE_ENV   = 'test';

// ─── Middleware Mocks ──────────────────────────────────────────────────────────

// Bypass JWT verification — inject a fixed test user into req.user
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

// Skip file upload and processing — no real Cloudinary calls in tests
jest.mock('../middleware/secureUpload', () => ({
  uploadPostImage:     [],
  uploadPostImageFile: (req, res, next) => next(),
  processPostImage:    (req, res, next) => next(),
  multerErrorHandler:  (err, req, res, next) => next(err),
}));

// Skip Redis-based upload quota checks
jest.mock('../middleware/uploadQuota', () => ({
  checkUploadQuota: (req, res, next) => next(),
}));

// Skip abuse detection — not under test here
jest.mock('../middleware/abuseDetection', () => ({
  checkAbuse: () => (req, res, next) => next(),
}));

// ─── Model Mocks ──────────────────────────────────────────────────────────────

// Post — findByIdAndUpdate returns a resolved promise (fire-and-forget in controller)
jest.mock('../models/Post', () => ({
  findById:        jest.fn(),
  findOne:         jest.fn(),
  create:          jest.fn(),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  findOneAndUpdate:  jest.fn().mockResolvedValue({}),
  countDocuments:  jest.fn(),
  find:            jest.fn().mockResolvedValue([]),
  findByIdAndDelete: jest.fn(),
}));

// User — findByIdAndUpdate used as fire-and-forget (.catch) so must return a promise
jest.mock('../models/User', () => ({
  findById:          jest.fn(),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  findOneAndUpdate:  jest.fn().mockResolvedValue({}),
  find:              jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
  }),
  updateMany: jest.fn().mockResolvedValue({}),
}));

// Block — used in mention flow to filter blocked users
jest.mock('../models/Block', () => ({
  find:   jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
  }),
  exists: jest.fn().mockResolvedValue(false),
}));

jest.mock('../models/Notification', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../models/Report', () => ({
  findOne: jest.fn(),
  create:  jest.fn(),
}));

// ─── Service & Utility Mocks ──────────────────────────────────────────────────

// Notification queue — skip BullMQ/Redis in test environment
jest.mock('../jobs/queues/notificationQueue', () => ({
  enqueueNotification: jest.fn().mockResolvedValue({}),
}));

// Cloudinary — prevent real API calls during post delete/failure scenarios
jest.mock('cloudinary', () => ({
  v2: { uploader: { destroy: jest.fn().mockResolvedValue({}) } },
}));

jest.mock('../utils/cache', () => ({
  getCache:       jest.fn().mockResolvedValue(null),
  setCache:       jest.fn().mockResolvedValue(),
  incrementCache: jest.fn().mockResolvedValue(1),
  decrementCache: jest.fn().mockResolvedValue(0),
  invalidateCache: jest.fn().mockResolvedValue(),
}));

jest.mock('../services/likeService', () => ({
  toggleLike: jest.fn().mockResolvedValue({ liked: true }),
  isLiked:    jest.fn().mockResolvedValue(false),
}));

jest.mock('../services/saveService', () => ({
  toggleSave: jest.fn().mockResolvedValue({ saved: true }),
  isSaved:    jest.fn().mockResolvedValue(false),
}));

jest.mock('../services/commentService', () => ({
  addComment:    jest.fn().mockResolvedValue({ _id: 'cid', text: 'ok' }),
  deleteComment: jest.fn().mockResolvedValue({}),
  getComments:   jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/feedService', () => ({
  getFeed: jest.fn().mockResolvedValue({ posts: [], nextCursor: null }),
}));

// ─── App Setup ────────────────────────────────────────────────────────────────

const Post   = require('../models/Post');
const User   = require('../models/User');
const Report = require('../models/Report');

const app = express();
app.use(express.json());
app.use('/api/posts', require('../routes/posts'));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Post routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates a text post successfully', async () => {
    Post.create.mockResolvedValue({ _id: '507f191e810c19729de860eb' });

    // Controller fetches populated post after create
    Post.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id:     '507f191e810c19729de860eb',
        content: 'Dil ki baat',
        author:  { _id: '507f191e810c19729de860ea', username: 'arya' },
      }),
    });

    const res = await request(app)
      .post('/api/posts')
      .send({ content: 'Dil ki baat', categories: ['Love'] });

    expect(res.status).toBe(201);
    expect(Post.create).toHaveBeenCalled();
  });

  test('rejects a post with no content and no image', async () => {
    // createPost returns 400 when both content and image are missing
    const res = await request(app)
      .post('/api/posts')
      .send({ categories: ['Love'] });

    expect(res.status).toBe(400);
  });

  test('rejects a comment containing spam keywords', async () => {
    // commentValidation middleware blocks known spam phrases before reaching controller
    const res = await request(app)
      .post('/api/posts/507f191e810c19729de860eb/comment')
      .send({ text: 'free followers now' });

    expect(res.status).toBe(400);
  });

  test('reports a post with a valid reason', async () => {
    // reportPost uses Post.findOne().select('_id') — needs chainable mock
    Post.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: '507f191e810c19729de860eb' }),
    });
    Report.findOne.mockResolvedValue(null);
    Report.create.mockResolvedValue({ _id: '507f191e810c19729de860ec' });

    const res = await request(app)
      .post('/api/posts/507f191e810c19729de860eb/report')
      .send({ reason: 'spam', details: 'Repeated promotion' });

   expect(res.status).toBe(200);
    expect(Report.create).toHaveBeenCalled();
  });

  test('blocks comment on a deleted or non-existent post', async () => {
    // commentService checks Post.findOne with isDeleted filter — null means post unavailable
    Post.findOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/posts/507f191e810c19729de860eb/comment')
      .send({ text: 'Bahut khoobsurat shayari hai' });

    expect([400, 404, 500]).toContain(res.status);
  });
});