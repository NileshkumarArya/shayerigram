/**
 * Anti-Scraping Middleware
 * Light layer of defense against automated scrapers and data miners.
 * NOT a replacement for Cloudflare Bot Management — that's the real defense.
 * This catches low-effort bots that don't bother setting a UA.
 */
const logger = require('../utils/logger');

// Known bad bot user-agent patterns (common scrapers/harvesters)
const BAD_UA_PATTERNS = [
  /python-requests/i,
  /go-http-client/i,
  /java\/\d/i,
  /curl\//i,
  /wget\//i,
  /scrapy/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /dotbot/i,
  /petalbot/i,
  /bytespider/i,
  /gptbot/i,          // OpenAI crawler
  /claudebot/i,       // Anthropic crawler
  /ccbot/i,           // CommonCrawl (used for AI training)
  /dataforseobot/i,
];

// ✅ FIX 6: Block empty/missing UA and known scraper UAs on public API routes
const blockScrapers = (req, res, next) => {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') return next();

  const ua = req.headers['user-agent'] || '';

  // Block empty/missing user agents
  if (!ua.trim()) {
    logger.warn('Empty user-agent blocked', { ip: req.ip, path: req.path });
    return res.status(403).json({ message: 'Access denied.' });
  }

  // Block known scraper patterns
  for (const pattern of BAD_UA_PATTERNS) {
    if (pattern.test(ua)) {
      logger.warn('Scraper UA blocked', { ip: req.ip, ua: ua.slice(0, 80), path: req.path });
      return res.status(403).json({ message: 'Access denied.' });
    }
  }

  next();
};

// Add X-Robots-Tag to all API responses (tells well-behaved crawlers to skip)
const addRobotsHeader = (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
};

module.exports = { blockScrapers, addRobotsHeader };
