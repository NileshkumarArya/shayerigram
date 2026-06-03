/**
 * Per-user upload quota
 * Prevents:
 *   - Storage abuse
 *   - Bot bulk uploading
 *   - Excessive API costs
 */
const { incrementCache, decrementCache } = require('../utils/cache');
const logger = require('../utils/logger');

const LIMITS = {
  // Max uploads per window
  hourly: { max: 5,  windowSec: 3600  },  // 5 images/hour
  daily:  { max: 20, windowSec: 86400 },  // 20 images/day
};

const checkUploadQuota = async (req, res, next) => {
  if (!req.user) return next();

  // Only count actual file uploads. Text-only multipart posts should not consume image quota.
  if (!req.file) return next();

  const userId = String(req.user._id);

  try {
    const hourKey = `quota:upload:hour:${userId}`;
    const dayKey = `quota:upload:day:${userId}`;

    const [hourCount, dayCount] = await Promise.all([
      incrementCache(hourKey, LIMITS.hourly.windowSec),
      incrementCache(dayKey, LIMITS.daily.windowSec),
    ]);

    const releaseQuota = async () => {
      await Promise.all([
        decrementCache(hourKey),
        decrementCache(dayKey),
      ]);
    };

    if (hourCount > LIMITS.hourly.max) {
      await releaseQuota();
      logger.warn('Upload quota exceeded (hourly)', { userId, count: hourCount });
      return res.status(429).json({
        message: `Upload limit reached. Max ${LIMITS.hourly.max} images per hour.`,
        code: 'UPLOAD_QUOTA_HOURLY',
      });
    }

    if (dayCount > LIMITS.daily.max) {
      await releaseQuota();
      logger.warn('Upload quota exceeded (daily)', { userId, count: dayCount });
      return res.status(429).json({
        message: `Daily upload limit reached. Max ${LIMITS.daily.max} images per day.`,
        code: 'UPLOAD_QUOTA_DAILY',
      });
    }

    // Quota reserve ho chuka hai. Upload fail hua to reserve wapas release karo.
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        releaseQuota().catch(() => {});
      }
    });

    next();
  } catch {
    next();
  }
};

module.exports = { checkUploadQuota };
