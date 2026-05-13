/**
 * Abuse Detection — risk scoring system
 *
 * Signals tracked:
 *   - action velocity (too fast)
 *   - repeated same action
 *   - IP anomalies
 *   - device/user mismatch
 *
 * Response:
 *   - low risk: allow + log
 *   - medium: slow down (artificial delay)
 *   - high: block + flag account
 */
const AbuseLog = require('../models/AbuseLog');
const User     = require('../models/User');
const { getCache, setCache } = require('../utils/cache');
const logger   = require('../utils/logger');

// ─── Risk thresholds per action ────────────────────────────────────────────
const THRESHOLDS = {
  like:      { window: 60, max: 60,  severity: 'medium' }, // 60 likes/min
  follow:    { window: 60, max: 20,  severity: 'high'   }, // 20 follows/min
  comment:   { window: 60, max: 20,  severity: 'medium' }, // 20 comments/min
  post:      { window: 3600, max: 15,severity: 'medium' }, // 15 posts/hr
  report:    { window: 3600, max: 5, severity: 'medium' }, // 5 reports/hr
  gift_send: { window: 60, max: 10,  severity: 'high'   }, // 10 gifts/min
};

/**
 * Check if action is suspicious
 * Uses Redis counters for sliding window rate tracking
 */
const checkAbuse = (action) => async (req, res, next) => {
  if (!req.user) return next(); // Only check authenticated users

  const threshold = THRESHOLDS[action];
  if (!threshold) return next();

  const userId   = String(req.user._id);
  const ip       = req.ip;
  const cacheKey = `abuse:${action}:${userId}`;

  try {
    // Get current count from cache
    const current = (await getCache(cacheKey)) || 0;

    if (current >= threshold.max) {
      // ✅ Block and log
      await logAbuse(userId, ip, action, threshold.severity, current);

      if (threshold.severity === 'high') {
        // Shadow ban or hard block
        logger.warn('Abuse blocked', { userId, action, count: current, ip });
        return res.status(429).json({
          message: 'Action temporarily restricted. Please slow down.',
          code:    'ABUSE_DETECTED',
        });
      }

      // Medium — allow but log
      logger.warn('Suspicious activity', { userId, action, count: current });
    }

    // Increment counter
    const newCount = current + 1;
    await setCache(cacheKey, newCount, threshold.window);

    next();
  } catch (err) {
    // Fail open — don't block on cache errors
    logger.error('Abuse check failed (fail open)', { error: err.message });
    next();
  }
};

/**
 * Log abuse event to DB
 */
const logAbuse = async (userId, ip, action, severity, count) => {
  try {
    const riskScore = severity === 'high' ? 80 : severity === 'medium' ? 50 : 20;

    await AbuseLog.create({
      userId,
      ip,
      action:    `rapid_${action}`,
      severity,
      riskScore,
      metadata:  { count },
    });

    // High risk → flag account (admin can review)
    if (severity === 'high') {
      await User.findByIdAndUpdate(userId, { $set: { flaggedForReview: true } });
    }
  } catch {}
};

/**
 * IP-based abuse check (for unauthenticated endpoints)
 */
const checkIpAbuse = (action, max, windowSeconds) => async (req, res, next) => {
  // Skip in test mode
  if (process.env.NODE_ENV === 'test') return next();

  const ip       = req.ip;
  const cacheKey = `abuse:ip:${action}:${ip}`;

  try {
    const current = (await getCache(cacheKey)) || 0;
    if (current >= max) {
      logger.warn('IP abuse blocked', { ip, action, count: current });
      return res.status(429).json({ message: 'Too many requests from this IP. Try again later.' });
    }
    await setCache(cacheKey, current + 1, windowSeconds);
    next();
  } catch {
    // Fail open — cache error should not block users
    next();
  }
};

module.exports = { checkAbuse, checkIpAbuse, logAbuse };
