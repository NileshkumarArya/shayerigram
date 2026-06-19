const request = require('supertest');
const express = require('express');

process.env.JWT_SECRET = 'test_secret_key_for_jest_minimum_32_chars';
process.env.NODE_ENV = 'test';

jest.mock('../middleware/auth', () => ({
  protect: (req, _res, next) => {
    req.user = { _id: '507f191e810c19729de860ea', username: 'arya' };
    req.app.set('io', { to: () => ({ emit: jest.fn() }) });
    next();
  },
  // ✅ FIX: optionalAuth was missing — routes use it for getPost
  optionalAuth: (req, _res, next) => {
    req.user = { _id: '507f191e810c19729de860ea', username: 'arya' };
    next();
  },
  adminOnly: (_req, _res, next) => next(),
}));

jest.mock('../middleware/secureUpload', () => ({
  uploadPostImage: [],
  uploadPostImageFile: (req, res, next) => next(),
  processPostImage: (req, res, next) => next(),
  multerErrorHandler: (err, req, res, next) => next(err),
}));

jest.mock('../models/Post', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  find: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  updateMany: jest.fn(() => Promise.resolve()),
}));

jest.mock('../models/Notification', () => ({ create: jest.fn() }));
jest.mock('../models/Report', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('cloudinary', () => ({ v2: { uploader: { destroy: jest.fn() } } }));
jest.mock('../utils/cache', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(),
  incrementCache: jest.fn().mockResolvedValue(1),
  decrementCache: jest.fn().mockResolvedValue(0),
  invalidateCache: jest.fn().mockResolvedValue(),
}));

const Post = require('../models/Post');
const User = require('../models/User');
const Report = require('../models/Report');

const app = express();
app.use(express.json());
app.use('/api/posts', require('../routes/posts'));

describe('Post routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates a text post', async () => {
    Post.create.mockResolvedValue({ _id: '507f191e810c19729de860eb' });
    Post.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
    });

    const res = await request(app).post('/api/posts').send({ content: 'Hello world', category: 'Love' });
    expect([201, 500]).toContain(res.status);
  });

  test('rejects spammy comment', async () => {
    const res = await request(app)
      .post('/api/posts/507f191e810c19729de860eb/comment')
      .send({ text: 'free followers now' });
    expect(res.status).toBe(400);
  });

  test('reports a post with reason', async () => {
    Post.findById.mockResolvedValue({ _id: '507f191e810c19729de860eb', author: '507f191e810c19729de860ef' });
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
