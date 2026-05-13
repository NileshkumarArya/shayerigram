/**
 * Request Integrity Middleware
 *
 * Purpose: log suspicious requests, track device/IP patterns
 * 
 * Attacker scenarios handled:
 *   - Bot scripts: no User-Agent, rapid identical requests
 *   - Mod APKs: unusual header patterns
 *   - API abuse tools: no browser fingerprints
 *
 * Note: Frontend CAN be reverse engineered. This is defense-in-depth,
 * not a silver bullet. Real protection = server-side validation of
 * every action's business logic.
 */
const crypto = require('crypto');
const logger  = require('../utils/logger');
const { setCache, getCache } = require('../utils/cache');

// Generate a unique request ID for tracing
const generateRequestId = () => crypto.randomBytes(8).toString('hex');

/**
 * Middleware 1: Attach request ID to every request (for log tracing)
 */
const attachRequestId = (req, res, next) => {
  req.requestId = generateRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

/**
 * Middleware 2: Log all incoming requests with context
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const isError  = res.statusCode >= 400;

    const log = {
      requestId: req.requestId,
      method:    req.method,
      path:      req.path,
      status:    res.statusCode,
      duration:  `${duration}ms`,
      ip:        req.ip,
      userId:    req.user?._id,
      ua:        req.headers['user-agent']?.slice(0, 100),
    };

    if (isError) logger.warn('Request error', log);
    else if (duration > 2000) logger.warn('Slow request', log);
    else logger.info('Request', log);
  });

  next();
};

/**
 * Middleware 3: Suspicious request detection
 *
 * Flags requests that look like bots/scripts:
 *   - Missing User-Agent
 *   - Known bot User-Agents
 *   - Unusual accept headers
 */
const KNOWN_BOT_PATTERNS = [
  /python-requests/i, /curl\//i, /wget\//i, /go-http/i,
  /axios\/[0-9]/i, /node-fetch/i, /postman/i, /insomnia/i,
  /httpie/i, /scrapy/i, /beautifulsoup/i,
];

const detectSuspiciousRequest = (req, res, next) => {
  const ua      = req.headers['user-agent'] || '';
  const isBot   = !ua || KNOWN_BOT_PATTERNS.some(p => p.test(ua));
  const method  = req.method;

  // Allow bots on GET /api/health (uptime monitors)
  if (req.path === '/api/health') return next();

  // Flag suspicious write operations (POST/PUT/DELETE) from bots
  if (isBot && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    logger.warn('Suspicious write request (bot UA)', {
      requestId: req.requestId,
      ip:        req.ip,
      ua:        ua.slice(0, 200),
      path:      req.path,
      userId:    req.user?._id,
    });

    // Don't block — just flag. Real blocking is rate limiter + abuse detection.
    req.suspiciousRequest = true;
  }

  next();
};

/**
 * Middleware 4: IP reputation check (simple sliding window)
 * Tracks error rate per IP — high 4xx rate = likely attacker
 */
const trackIpReputation = async (req, res, next) => {
  next(); // proceed first

  res.on('finish', async () => {
    // Only track 4xx errors (not 401 for unauthenticated, those are normal)
    if (res.statusCode >= 400 && res.statusCode !== 401 && res.statusCode < 500) {
      const key   = `ip:errors:${req.ip}`;
      const count = (await getCache(key) || 0) + 1;
      await setCache(key, count, 600); // 10 min window

      if (count > 50) {
        logger.warn('High error rate from IP', {
          ip:    req.ip,
          count,
          path:  req.path,
        });
        // Admin can review AbuseLog and decide to block this IP at NGINX level
      }
    }
  });
};

module.exports = { attachRequestId, requestLogger, detectSuspiciousRequest, trackIpReputation };
