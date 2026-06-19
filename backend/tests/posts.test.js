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

// Chainable mock — .select().lean().populate() sab support karta hai
const makeChain = (result) => {
  const chain = {};
  ['select', 'populate', 'lean', 'exec', 'sort', 'limit', 'skip'].forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.then = (res, rej) => Promise.resolve(result).then(res, rej);
  chain.catch = (fn) => Promise.resolve(result).catch(fn);
  return chain;
};

// Chainable mock that also works with await directly
const makeResolvingChain = (result) => {
  const p = Promise.resolve(result);
  const chain = {
    select: jest.fn().mockReturnValue(p),
    populate: jest.fn().mockReturnValue(p),
    lean: jest.fn().mockReturnValue(p),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
  return chain;
};

jest.mock('../models/Post', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  // findByIdAndUpdate returns a promise directly (no .select chain needed)
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  countDocuments: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  // findByIdAndUpdate must return a thenable (has .catch) — fire-and-forget in controller
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  find: jest.fn().mockResolvedValue([]),
  updateMany: jest.fn().mockResolvedValue({}),
}));

jest.mock('../models/Block', () => ({
  find: jest.fn().mockResolvedValue([]),
}));

jest.mock('../models/Notification', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../models/Report', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/AbuseLog', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('cloudinary', () => ({ v2: { uploader: { destroy: jest.fn() } } }));

jest.mock('../utils/cache', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(),
  incrementCache: jest.fn().mockResolvedValue(1),
  decrementCache: jest.fn().mockResolvedValue(0),
  invalidateCache: jest.fn().mockResolvedValue(),
}));

jest.mock('../services/likeService', () => ({ toggleLike: jest.fn().mockResolvedValue({ liked: true }) }));
jest.mock('../services/saveService', () => ({ toggleSave: jest.fn().mockResolvedValue({ saved: true }) }));
jest.mock('../services/commentService', () => ({
  addComment: jest.fn().mockResolvedValue({ _id: 'cid', text: 'ok' }),
  deleteComment: jest.fn().mockResolvedValue({}),
  getComments: jest.fn().mockResolvedValue([]),
}));
jest.mock('../services/feedService', () => ({ getFeed: jest.fn().mockResolvedValue({ posts: [], nextCursor: null }) }));

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
    // findById chain: controller calls .populate() then awaits result
    Post.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: '507f191e810c19729de860eb',
        content: 'Hello world',
        author: { _id: '507f191e810c19729de860ea', username: 'arya' },
      }),
    });

    const res = await request(app).post('/api/posts').send({ content: 'Hello world', category: 'Love' });
    expect(res.status).toBe(201);
  });

  test('rejects spammy comment', async () => {
    const res = await request(app)
      .post('/api/posts/507f191e810c19729de860eb/comment')
      .send({ text: 'free followers now' });
    expect(res.status).toBe(400);
  });

  test('reports a post with reason', async () => {
    // reportPost uses Post.findOne().select() — needs chainable mock
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