const rateLimit = require('express-rate-limit');

// ✅ Redis-backed store for multi-instance rate limiting
// Falls back to memory if Redis unavailable
let redisStore = null;
const getStore = () => {
  if (redisStore) return { store: redisStore };
  if (process.env.REDIS_URL && !isTest) {
    try {
      const { RedisStore } = require('rate-limit-redis');
      const { createClient } = require('redis');
      const client = createClient({ url: process.env.REDIS_URL });
      client.connect().catch(() => {});
      redisStore = new RedisStore({ sendCommand: (...args) => client.sendCommand(args) });
      return { store: redisStore };
    } catch {
      // rate-limit-redis not installed — memory fallback
    }
  }
  return {}; // memory store (default)
};

// ✅ Skip ALL rate limiting in test environment
const isTest = process.env.NODE_ENV === 'test';

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { message: 'Too many requests. Please try again later.' },
  ...getStore(), // ✅ Redis-backed in production, memory fallback in dev
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  skipSuccessfulRequests: true,
  ...getStore(),
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
  message: { message: 'Post limit reached. Max 30 posts per hour.' },
});

const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: userOrIpKey,
  message: { message: 'Commenting too fast. Please slow down.' },
});

const followLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: userOrIpKey,
  message: { message: 'Too many follow actions. Please slow down.' },
});

const likeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: userOrIpKey,
  message: { message: 'Too many likes. Please slow down.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: userOrIpKey,
  message: { message: 'Upload limit reached. Max 5 image uploads per hour.' },
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { message: 'Too many search requests.' },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,               // 60 admin actions/min — enough for real use, blocks scripts
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { message: 'Admin rate limit exceeded. Please slow down.' },
  keyGenerator: (req) => `admin:${req.user?._id || req.ip}`, // per-admin, not per-IP
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { message: 'Too many password reset requests. Try again in 1 hour.' },
});

module.exports = {
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
