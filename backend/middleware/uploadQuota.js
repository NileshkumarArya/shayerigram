/**
 * Per-user upload quota
 * Prevents:
 *   - Storage abuse
 *   - Bot bulk uploading
 *   - Excessive API costs
 */
const { getCache, setCache } = require('../utils/cache');
const logger = require('../utils/logger');

const LIMITS = {
  // Max uploads per window
  hourly: { max: 5,  windowSec: 3600  },  // 5 images/hour
  daily:  { max: 20, windowSec: 86400 },  // 20 images/day
};

const checkUploadQuota = async (req, res, next) => {
  if (!req.user) return next(); // Auth middleware handles unauth

  // Only check if request has a file upload
  if (!req.headers['content-type']?.includes('multipart/form-data')) return next();

  const userId = String(req.user._id);

  try {
    const hourKey  = `quota:upload:hour:${userId}`;
    const dayKey   = `quota:upload:day:${userId}`;

    const [hourCount, dayCount] = await Promise.all([
      getCache(hourKey) || 0,
      getCache(dayKey)  || 0,
    ]);

    if (hourCount >= LIMITS.hourly.max) {
      logger.warn('Upload quota exceeded (hourly)', { userId, count: hourCount });
      return res.status(429).json({
        message: `Upload limit reached. Max ${LIMITS.hourly.max} images per hour.`,
        code:    'UPLOAD_QUOTA_HOURLY',
      });
    }

    if (dayCount >= LIMITS.daily.max) {
      logger.warn('Upload quota exceeded (daily)', { userId, count: dayCount });
      return res.status(429).json({
        message: `Daily upload limit reached. Max ${LIMITS.daily.max} images per day.`,
        code:    'UPLOAD_QUOTA_DAILY',
      });
    }

    // Increment on success (do after upload succeeds via res finish)
    res.on('finish', async () => {
      if (res.statusCode === 201 || res.statusCode === 200) {
        await Promise.all([
          setCache(hourKey, (hourCount + 1), LIMITS.hourly.windowSec),
          setCache(dayKey,  (dayCount + 1),  LIMITS.daily.windowSec),
        ]);
      }
    });

    next();
  } catch {
    next(); // Fail open on cache error
  }
};

module.exports = { checkUploadQuota };
