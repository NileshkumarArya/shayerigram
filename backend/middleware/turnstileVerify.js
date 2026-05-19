/**
 * Cloudflare Turnstile server-side verification middleware
 */

const DEV_BYPASS_TOKENS = new Set([
  'auto-verify',
  'dev-bypass',
  'bypass-error',
  'script-load-failed',
  'timeout-bypass',
]);

const verifyTurnstile = async (req, res, next) => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Skip in test or if no key configured
  if (!secretKey || process.env.NODE_ENV === 'test') return next();

  const token = req.body['cf-turnstile-response'] || req.body.captchaToken;
  if (!token) {
    return res.status(400).json({ message: 'Captcha verification required.' });
  }

  // Dev-only bypass tokens. Never allow captcha bypass in production.
  if (process.env.NODE_ENV !== 'production' && DEV_BYPASS_TOKENS.has(token)) {
    return next();
  }

  // Verify with Cloudflare — fail open if Cloudflare is down
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secretKey, response: token, remoteip: req.ip }),
    });
    const data = await response.json();
    if (!data.success) {
      console.warn('[TURNSTILE] Failed:', data['error-codes'], 'token:', token?.slice(0, 20));
      return res.status(400).json({ message: 'Captcha failed. Please try again.' });
    }
    next();
    } catch (err) {
    console.warn('[TURNSTILE] Verification error:', err.message);

    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        message: 'Captcha verification is temporarily unavailable. Please try again.',
      });
    }

    next();
  }
};

module.exports = { verifyTurnstile };