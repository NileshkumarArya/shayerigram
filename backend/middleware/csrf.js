const crypto = require('crypto');
const logger = require('../utils/logger');

const CSRF_COOKIE_NAME  = 'csrfToken';
const CSRF_HEADER_NAME  = 'x-csrf-token';

// Log-only by default. This requires the frontend to send the header on
// every mutating request — flip to 'true' in Render's env vars only after
// confirming in the logs (below) that real traffic is matching correctly.
// Getting this wrong in enforce mode would 403 every post/comment/like/
// follow/login on the whole site, so it starts safe on purpose.
const CSRF_ENFORCE = String(process.env.CSRF_ENFORCE) === 'true';

// ─── Ensure every visitor has a CSRF token cookie ───────────────────────────
// Not httpOnly — on purpose. The frontend's own JS reads this cookie and
// echoes it back as a header on every mutating request. A cross-site
// attacker's page can't do the same: same-origin policy blocks their JS
// from reading OUR cookie's value, even though their forged request still
// carries it automatically. So the header can only ever match the cookie
// on a request that actually came from our own frontend's JS.
const ensureCsrfCookie = (req, res, next) => {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    const token = crypto.randomBytes(32).toString('hex');
    const isCrossDomain = String(process.env.CROSS_DOMAIN) === 'true';
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: isProd || isCrossDomain,
      sameSite: isCrossDomain ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — independent of login state
    });

    // Make it usable in THIS same request too, not just the next one.
    req.cookies = req.cookies || {};
    req.cookies[CSRF_COOKIE_NAME] = token;
  }
  next();
};

// ─── Verify header matches cookie, for mutating requests ───────────────────
// Second, independent layer alongside server.js's Origin check — not a
// replacement. Mobile is exempt for the same reason the Origin check exempts
// it: it authenticates with a manually-attached Bearer token, not an ambient
// cookie, so CSRF (which relies on a browser auto-attaching cookies) doesn't
// apply to it in the first place.
const verifyCsrfToken = (req, res, next) => {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!mutating) return next();
  if (req.headers['x-client-platform'] === 'mobile') return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];
  const matches = !!cookieToken && !!headerToken && cookieToken === headerToken;

  if (!matches) {
    logger.warn('CSRF token mismatch', {
      ip: req.ip,
      path: req.path,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      enforced: CSRF_ENFORCE,
    });
    if (CSRF_ENFORCE) {
      return res.status(403).json({ message: 'Invalid or missing CSRF token.' });
    }
  }
  next();
};

// Frontend (Vercel) aur backend (Render) alag domains hain — is wajah se
// frontend ka JS Render ke cookie ko document.cookie se padh nahi sakta
// (browser ka same-origin rule). Isliye token value ek dedicated endpoint
// se bhejte hain response body mein, cookie khud se nahi.
const getCsrfToken = (req, res) => {
  res.json({ csrfToken: req.cookies?.[CSRF_COOKIE_NAME] || null });
};

module.exports = { ensureCsrfCookie, verifyCsrfToken, getCsrfToken, CSRF_COOKIE_NAME, CSRF_HEADER_NAME };