/**
 * Cloudflare Turnstile server-side verification middleware
 *
 * Setup:
 * 1. Get secret key from dash.cloudflare.com → Turnstile
 * 2. Add TURNSTILE_SECRET_KEY to .env
 * 3. Add middleware to register + login routes
 */

const verifyTurnstile = async (req, res, next) => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Skip in dev/test if no key configured
  if (!secretKey || process.env.NODE_ENV === 'test') return next();

  const token = req.body['cf-turnstile-response'] || req.body.captchaToken;
  if (!token) {
    return res.status(400).json({ message: 'Captcha verification required.' });
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secretKey, response: token, remoteip: req.ip }),
    });
    const data = await response.json();
    if (!data.success) {
      return res.status(400).json({ message: 'Captcha failed. Please try again.' });
    }
    next();
  } catch (err) {
    // If Cloudflare is down, allow request (fail open — availability > strict)
    console.warn('[TURNSTILE] Verification failed — allowing request:', err.message);
    next();
  }
};

module.exports = { verifyTurnstile };
