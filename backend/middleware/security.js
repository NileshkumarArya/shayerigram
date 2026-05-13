const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

// ─── Multi-origin support (comma separated in .env) ───────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ─── Environment helpers ──────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

// ─── Configurable cookie name (override via AUTH_COOKIE_NAME in .env) ────
const cookieName = process.env.AUTH_COOKIE_NAME || 'access_token';

// ─── HttpOnly Cookie options (used by auth controller + auth middleware) ──
// ── Cross-domain detection ───────────────────────────────────────────────
// If frontend & backend are on different domains (e.g. Vercel + Railway),
// SameSite must be 'none' + secure:true, else cookie won't be sent cross-site.
const isCrossDomain = String(process.env.CROSS_DOMAIN) === 'true'; // 'false' string won't be truthy

const authCookieOptions = {
  httpOnly: true,                                                        // JS cannot read — XSS protection
  secure: isProduction || isCrossDomain,                                 // HTTPS required for cross-domain
  sameSite: isCrossDomain ? 'none' : 'lax', // 'none' for cross-domain, 'lax' for same-domain (works better with navigations)
  path: '/',
  maxAge: 15 * 24 * 60 * 60 * 1000,                                    // 15 days in ms
};

// ─── Content Security Policy (Full CSP) ──────────────────────────────────
exports.securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc:             ["'self'"],
      imgSrc:                 ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      // ✅ FIX 4: Removed 'unsafe-inline' from styleSrc on backend (API server serves JSON, not HTML)
      // Frontend CSP is handled via vercel.json headers
      styleSrc:               ["'self'", 'https://fonts.googleapis.com'],
      fontSrc:                ["'self'", 'https://fonts.gstatic.com', 'data:'],
      connectSrc:             ["'self'", ...allowedOrigins],
      frameAncestors:         ["'none'"],
      objectSrc:              ["'none'"],
      scriptSrc:              ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// ─── NoSQL Injection Protection ───────────────────────────────────────────
exports.mongoSanitize = mongoSanitize;

// ─── Allowed Origins (for CORS) ───────────────────────────────────────────
exports.allowedOrigins = allowedOrigins;

// ─── Exported helpers ─────────────────────────────────────────────────────
exports.isProduction        = isProduction;
exports.cookieName          = cookieName;
exports.authCookieOptions   = authCookieOptions;

// ─── Cookie Parser Utility ────────────────────────────────────────────────
exports.parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rawVal] = part.trim().split('=');
    if (!rawKey) return acc;
    try { acc[rawKey.trim()] = decodeURIComponent(rawVal.join('=')); }
    catch { acc[rawKey.trim()] = rawVal.join('='); }
    return acc;
  }, {});
};

// ─── String Sanitizer Utility ─────────────────────────────────────────────
exports.sanitizeString = (value, maxLength = 500) => {
  if (value === undefined || value === null) return undefined;
  return String(value)
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, '')   // Strip control chars
    .slice(0, maxLength);
};
