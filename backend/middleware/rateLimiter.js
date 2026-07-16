const rateLimit = require('express-rate-limit');
const { getSharedRedisClient } = require('../utils/cache');

let RedisStoreClass = null;
try {
  ({ RedisStore: RedisStoreClass } = require('rate-limit-redis'));
} catch {
  // rate-limit-redis not installed — every limiter below falls back to memory
}

// ✅ Skip ALL rate limiting in test environment
const isTest = process.env.NODE_ENV === 'test';

// Each limiter needs its OWN RedisStore instance — express-rate-limit throws
// ERR_ERL_STORE_REUSE if the same instance is handed to more than one limiter
// — and its own key prefix, otherwise different limiters (e.g. login vs.
// comment) would read/write the same Redis keys and their counts would bleed
// into each other. Also only builds a store once the shared client reports
// isReady: building one against a client that hasn't finished connecting yet
// fails inside RedisStore's own script-preload step, and since this runs once
// at module-load time, that limiter would stay silently broken for the life
// of the process. Falling back to memory here is safe and already tested;
// getting Redis-backed limiting to actually engage needs connectCache() to
// resolve before this file is required, which is a separate, bigger change.
const getStore = (name) => {
  const client = getSharedRedisClient();
  if (client && client.isReady && RedisStoreClass && !isTest) {
    return {
      store: new RedisStoreClass({
        prefix: `rl:${name}:`,
        sendCommand: (...args) => client.sendCommand(args),
      }),
    };
  }
  return {}; // memory store (default)
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { message: 'Too many requests. Please try again later.' },
  ...getStore('general'),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  skipSuccessfulRequests: true,
  ...getStore('login'),
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  handler: (req, res, next, options) => {
    console.warn(`[SECURITY] Login rate limit hit - IP: ${req.ip} - Email: ${req.body?.email}`);
    res.status(options.statusCode).json(options.message);
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  ...getStore('register'),
  message: { message: 'Too many accounts created from this IP. Please try again later.' },
  handler: (req, res, next, options) => {
    console.warn(`[SECURITY] Register rate limit hit - IP: ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
});

// ✅ SECURITY FIX: Key by userId (not just IP) for authenticated action limiters
// Prevents IP-rotation bypass — account-level limits can't be bypassed by changing IP
const userOrIpKey = (req) => req.user?._id?.toString() || req.ip;

const createPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: userOrIpKey,
  ...getStore('createPost'),
  message: { message: 'Post limit reached. Max 30 posts per hour.' },
});

const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: userOrIpKey,
  ...getStore('comment'),
  message: { message: 'Commenting too fast. Please slow down.' },
});

const followLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: userOrIpKey,
  ...getStore('follow'),
  message: { message: 'Too many follow actions. Please slow down.' },
});

const likeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: userOrIpKey,
  ...getStore('like'),
  message: { message: 'Too many likes. Please slow down.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Run after multer. Text-only posts should not consume image upload limit.
  skip: (req) => isTest || !req.file,
  keyGenerator: userOrIpKey,
  ...getStore('upload'),
  message: { message: 'Upload limit reached. Max 5 image uploads per hour.' },
});



const adminLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,               // 60 admin actions/min — enough for real use, blocks scripts
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  ...getStore('admin'),
  message: { message: 'Admin rate limit exceeded. Please slow down.' },
  keyGenerator: (req) => `admin:${req.user?._id || req.ip}`, // per-admin, not per-IP
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  ...getStore('search'),
  message: { message: 'Too many search requests.' },
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  ...getStore('forgot'),
  message: { message: 'Too many password reset requests. Try again in 1 hour.' },
});

const clubLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: userOrIpKey,
  ...getStore('club'),
  message: { message: 'Club creation limit reached. Max 5 clubs per day.' },
});

module.exports = {
  clubLimiter,
  generalLimiter,
  loginLimiter,
  registerLimiter,
  createPostLimiter,
  commentLimiter,
  followLimiter,
  likeLimiter,
  uploadLimiter,
  searchLimiter,
  adminLimiter,
  forgotLimiter,
};