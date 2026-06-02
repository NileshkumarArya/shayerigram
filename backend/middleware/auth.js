/**
 * Auth Middleware — JWT Access Token + Refresh Token system
 */
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, REFRESH_TOKEN_EXPIRY } = require('../utils/tokenService');
const { parseCookies, cookieName, authCookieOptions } = require('./security');
const logger = require('../utils/logger');

const extractToken = (req) => {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[cookieName] || null;
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (process.env.JWT_SECRET_PREV) {
      try { return jwt.verify(token, process.env.JWT_SECRET_PREV); }
      catch {}
    }
    throw err;
  }
};

// ─── Cookie helpers ──────────────────────────────────────────────────────────
const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production' || String(process.env.CROSS_DOMAIN) === 'true',
  sameSite: String(process.env.CROSS_DOMAIN) === 'true' ? 'none' : 'lax',
  path:     '/api/auth/refresh',
  maxAge:   REFRESH_TOKEN_EXPIRY * 1000,
});

const clearCookieOptions = (options = {}) => {
  const { maxAge, expires, ...clearOptions } = options;
  return clearOptions;
};

// ✅ FIX: same options se clear karo — browser tabhi cookie remove karta hai
const clearAuthCookies = (res) => {
  const refreshOptions = clearCookieOptions(getRefreshCookieOptions());
  const accessOptions  = clearCookieOptions(authCookieOptions);
  res.clearCookie('refreshToken', refreshOptions);
  res.clearCookie(cookieName, accessOptions);
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
    if (!req.user)            return res.status(401).json({ message: 'User no longer exists.' });
    if (req.user.isSuspended) return res.status(403).json({ message: 'Account suspended.' });
    if (req.user.isDeleted)   return res.status(403).json({ message: 'Account not found.' });
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
    const raw = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!raw) return res.status(401).json({ message: 'Refresh token required.' });

    const hashed = crypto.createHash('sha256').update(raw).digest('hex');

    const stored = await RefreshToken.findOneAndUpdate(
      {
        token:     hashed,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      },
      { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
      { new: false }
    );

    if (!stored) {
      logger.warn('Invalid/already-used refresh token', { ip: req.ip, ua: req.headers['user-agent']?.slice(0, 100) });
      return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }

    const user = await User.findById(stored.userId).select('-password');
    if (!user || user.isSuspended || user.isDeleted) {
      return res.status(403).json({ message: 'Account not accessible.' });
    }

    const newRefreshRaw = await generateRefreshToken(user._id, {
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
      deviceId:  stored.deviceId,
    });
    const accessToken = generateAccessToken(user._id);

    res.cookie('refreshToken', newRefreshRaw, getRefreshCookieOptions());
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
    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully.' });
  } catch {
    clearAuthCookies(res);
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
    clearAuthCookies(res);
    logger.info('All sessions revoked', { userId: req.user._id, sessionsRevoked: count.modifiedCount });
    res.json({ message: 'Logged out from all devices.' });
  } catch {
    clearAuthCookies(res);
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
    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'access') return next();

    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.isSuspended || user.isDeleted) return next();

    req.user = user;
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