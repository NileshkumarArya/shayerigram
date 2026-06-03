const logger = require('./logger');

const DEFAULT_TTL = Math.max(10, Number(process.env.REDIS_DEFAULT_TTL || 60));
let redisClient  = null;
let redisEnabled = false;
const memoryCache = new Map();

const getRedisLib = async () => {
  try { return require('redis'); } catch { return null; }
};

const buildKey = (key) => `sg:${key}`;

// ─── Memory cache helpers ─────────────────────────────────────────────────
const getMemory = (key) => {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { memoryCache.delete(key); return null; }
  return entry.value;
};

const setMemory = (key, value, ttl = DEFAULT_TTL) => {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
};

const incrementMemory = (key, ttl = DEFAULT_TTL) => {
  const now = Date.now();
  const entry = memoryCache.get(key);

  let value = 0;
  let expiresAt = now + ttl * 1000;

  if (entry && entry.expiresAt > now) {
    value = Number(entry.value) || 0;
    expiresAt = entry.expiresAt;
  }

  value += 1;
  memoryCache.set(key, { value, expiresAt });
  return value;
};

const decrementMemory = (key) => {
  const entry = memoryCache.get(key);
  if (!entry) return 0;

  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return 0;
  }

  const value = Math.max((Number(entry.value) || 0) - 1, 0);
  if (value === 0) {
    memoryCache.delete(key);
    return 0;
  }

  memoryCache.set(key, { value, expiresAt: entry.expiresAt });
  return value;
};

// ─── Connect ──────────────────────────────────────────────────────────────
const connectCache = async () => {
  if (!process.env.REDIS_URL) {
    logger.info('Cache running in memory mode');
    return;
  }
  const redis = await getRedisLib();
  if (!redis?.createClient) {
    logger.warn('redis package missing, cache fallback to memory');
    return;
  }
  try {
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => logger.warn('Redis error', { error: err.message }));
    await redisClient.connect();
    redisEnabled = true;
    logger.info('Redis cache connected');
  } catch (err) {
    logger.warn('Redis unavailable, fallback to memory', { error: err.message });
    redisClient = null;
    redisEnabled = false;
  }
};

// ─── Get ──────────────────────────────────────────────────────────────────
const getCache = async (key) => {
  if (redisEnabled && redisClient) {
    const cached = await redisClient.get(buildKey(key));
    return cached ? JSON.parse(cached) : null;
  }
  return getMemory(key);
};

// ─── Set ──────────────────────────────────────────────────────────────────
const setCache = async (key, value, ttl = DEFAULT_TTL) => {
  if (redisEnabled && redisClient) {
    await redisClient.set(buildKey(key), JSON.stringify(value), { EX: ttl });
    return;
  }
  setMemory(key, value, ttl);
};

// ─── Increment ────────────────────────────────────────────────────────────

const incrementCache = async (key, ttl = DEFAULT_TTL) => {
  if (redisEnabled && redisClient) {
    const redisKey = buildKey(key);

    const value = await redisClient.incr(redisKey);

    if (value === 1) {
      await redisClient.expire(redisKey, ttl);
    }

    return value;
  }

  return incrementMemory(key, ttl);
};

// ─── Decrement ────────────────────────────────────────────────────────────

const decrementCache = async (key) => {
  if (redisEnabled && redisClient) {
    const redisKey = buildKey(key);

    const value = await redisClient.decr(redisKey);

    if (value <= 0) {
      await redisClient.del(redisKey);
      return 0;
    }

    return value;
  }

  return decrementMemory(key);
};

// ─── Delete exact keys ────────────────────────────────────────────────────
const deleteCache = async (key) => {
  if (redisEnabled && redisClient) {
    await redisClient.del(buildKey(key));
    return;
  }
  memoryCache.delete(key);
};

// ✅ FIX: invalidateCache — EXACT keys only, NO dangerous KEYS/wildcard scan
// Pass an array of exact cache keys to delete
const invalidateCache = async (keys = []) => {
  const list = Array.isArray(keys) ? keys : [keys];
  await Promise.all(list.map(k => deleteCache(k)));
};

module.exports = {
  connectCache,
  getCache,
  setCache,
  incrementCache,
  decrementCache,
  deleteCache,
  invalidateCache,
};
