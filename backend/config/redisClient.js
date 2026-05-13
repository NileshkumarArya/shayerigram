/**
 * Shared Redis client (ioredis)
 * Used by: rate-limit-redis, socket adapter, manual cache
 *
 * Falls back to null if REDIS_URL not set
 * All consumers must handle null gracefully
 */
const logger = require('../utils/logger');

let redisClient = null;

if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck:     true,
      lazyConnect:          true,
    });

    redisClient.on('connect', () => logger.info('Redis client connected'));
    redisClient.on('error',   (e) => logger.warn('Redis client error', { error: e.message }));
  } catch (e) {
    logger.warn('ioredis not installed — Redis features disabled', { error: e.message });
    redisClient = null;
  }
}

module.exports = redisClient;
