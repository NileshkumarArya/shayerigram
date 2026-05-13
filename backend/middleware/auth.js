/**
 * Auth Middleware — JWT Access Token + Refresh Token system
 * Security hardened:
 *   - No JWT_SECRET fallback (validated at startup)
 *   - Refresh tokens stored hashed in DB
 *   - Token rotation on each refresh
 *   - Soft-deleted/suspended users blocked
 */
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, REFRESH_TOKEN_EXPIRY } = require('../utils/tokenService');
const { parseCookies, cookieName, authCookieOptions } = require('./security');
const logger = require('../utils/logger');

// ✅ FIX 2: Cookie-only token extraction — Bearer removed
// Reason: frontend uses httpOnly cookies. Bearer header allows XSS token theft if
// attacker somehow gets the token into localStorage. Cookie-only is safer.
// If you need API key access (mobile/third-party), use a separate API key middleware.
const extractToken = (req) => {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[cookieName] || null;
};

// ✅ FIX 7: JWT verify with rotation support
// JWT_SECRET_PREV allows zero-downtime key rotation:
// 1. Generate new secret → set JWT_SECRET=new, JWT_SECRET_PREV=old
// 2. Deploy — old tokens still work via JWT_SECRET_PREV
// 3. After all tokens expire (15 min), remove JWT_SECRET_PREV
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // Try previous secret if rotation is in progress
    if (process.env.JWT_SECRET_PREV) {
      try { return jwt.verify(token, process.env.JWT_SECRET_PREV); }
      catch {}
    }
    throw err;
  }
};

// ─── protect ────────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Not authorized. Please log in.' });

  try {
    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'access') return res.status(401).json({ message: 'Invalid token type.' });

    req.user = await User.findById(decoded.id)
      .select('-password -passwordResetToken -emailVerifyToken -knownIps -failedLoginAttempts');
    if (!req.user)             return res.status(401).json({ message: 'User no longer exists.' });
    if (req.user.isSuspended)  return res.status(403).json({ message: 'Account suspended.' });
    if (req.user.isDeleted)    return res.status(403).json({ message: 'Account not found.' });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ message: 'Access token expired.', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ message: 'Session invalid. Please log in again.' });
  }
};

// ─── refreshAccessToken ──────────────────────────────────────────────────────
const refreshAccessToken = async (req, res) => {
  try {
    // Support both cookie and body (mobile clients)
    const raw = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!raw) return res.status(401).json({ message: 'Refresh token required.' });

    const hashed = crypto.createHash('sha256').update(raw).digest('hex');

    // ✅ SECURITY FIX: Atomic revocation — findOneAndUpdate in a single DB op
    // Prevents race condition: two parallel refresh requests can't both succeed
    // because only ONE will match the un-revoked token; the second gets null
    const stored = await RefreshToken.findOneAndUpdate(
      {
        token:     hashed,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      },
      { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
      { new: false } // return original doc to confirm it was found & atomically revoked
    );

    if (!stored) {
      // Either invalid, expired, or already used by a parallel request
      logger.warn('Invalid/already-used refresh token', { ip: req.ip, ua: req.headers['user-agent']?.slice(0, 100) });
      return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }

    const user = await User.findById(stored.userId).select('-password');
    if (!user || user.isSuspended || user.isDeleted) {
      return res.status(403).json({ message: 'Account not accessible.' });
    }

    // Token already revoked atomically above — just issue new one

    const newRefreshRaw = await generateRefreshToken(user._id, {
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
      deviceId:  stored.deviceId,
    });
    const accessToken = generateAccessToken(user._id);

    // Set new refresh token cookie (scoped to refresh endpoint only)
    res.cookie('refreshToken', newRefreshRaw, getRefreshCookieOptions());

    // ✅ FIX: Also set access token cookie so browser uses updated token on retry
    // Without this, the axios interceptor retries with the old expired cookie → another 401
    res.cookie(cookieName, accessToken, authCookieOptions);

    logger.info('Token refreshed', { userId: user._id, ip: req.ip });
    res.json({ accessToken });
  } catch (err) {
    logger.error('Refresh token error', { error: err.message });
    res.status(500).json({ message: 'Token refresh failed.' });
  }
};

// ─── revokeCurrentDevice ─────────────────────────────────────────────────────
const revokeCurrentDevice = async (req, res) => {
  try {
    const raw = req.cookies?.refreshToken;
    if (raw) {
      const hashed = crypto.createHash('sha256').update(raw).digest('hex');
      await RefreshToken.findOneAndUpdate(
        { token: hashed },
        { revokedAt: new Date() }
      );
    }
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.clearCookie(cookieName);
    res.json({ message: 'Logged out successfully.' });
  } catch {
    // Always clear cookies even on error
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.clearCookie(cookieName);
    res.json({ message: 'Logged out successfully.' });
  }
};

// ─── revokeAllDevices ─────────────────────────────────────────────────────────
const revokeAllDevices = async (req, res) => {
  try {
    const count = await RefreshToken.updateMany(
      { userId: req.user._id, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.clearCookie(cookieName);
    logger.info('All sessions revoked', { userId: req.user._id, sessionsRevoked: count.modifiedCount });
    res.json({ message: 'Logged out from all devices.' });
  } catch {
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.clearCookie(cookieName);
    res.json({ message: 'Logged out from all devices.' });
  }
};

// ─── adminOnly ────────────────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required.' });
  next();
};

// ─── optionalAuth ─────────────────────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
  } catch {}
  next();
};

module.exports = {
  protect,
  adminOnly,
  optionalAuth,
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeCurrentDevice,
  revokeAllDevices,
};

// ✅ Centralized refresh cookie config — used in all auth flows
const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production' || String(process.env.CROSS_DOMAIN) === 'true',
  sameSite: String(process.env.CROSS_DOMAIN) === 'true' ? 'none' : 'lax',
  path:     '/api/auth/refresh',
  maxAge:   REFRESH_TOKEN_EXPIRY * 1000,
});

