/**
 * Token Service — isolated token generation
 * Separate from auth middleware to avoid circular dependency:
 *   authController → auth.js → User model → (no issue but complex)
 *
 * authController now only imports this lightweight util
 */
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRY  = '15m'; // ✅ Short-lived — refresh token handles persistence. 7d was too long (stolen token = 7 days access)
const REFRESH_TOKEN_EXPIRY = 90 * 24 * 60 * 60; // 90 days in seconds — stay logged in

/**
 * Generate short-lived access JWT
 */
const generateAccessToken = (userId) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
  return jwt.sign(
    { id: String(userId), type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
  );
};

/**
 * Generate refresh token (raw) + store hashed in DB
 */
const generateRefreshToken = async (userId, { ip, userAgent, deviceId } = {}) => {
  const RefreshToken = require('../models/RefreshToken');
  const raw    = crypto.randomBytes(64).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');

  await RefreshToken.create({
    userId,
    token:      hashed,
    deviceId,
    userAgent:  userAgent?.slice(0, 200),
    ip,
    expiresAt:  new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000),
    lastUsedAt: new Date(),
  });

  return raw; // Client stores raw, DB stores hash
};

/**
 * Short-lived token for the gap between "password correct" and "2FA code
 * verified" — proves the password step passed without yet granting a real
 * session. 5 minutes is enough to open an authenticator app and type a code.
 */
const generateTwoFactorPendingToken = (userId) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
  return jwt.sign(
    { id: String(userId), type: '2fa_pending' },
    process.env.JWT_SECRET,
    { expiresIn: '5m', algorithm: 'HS256' }
  );
};

module.exports = {
  generateAccessToken, generateRefreshToken, REFRESH_TOKEN_EXPIRY,
  generateTwoFactorPendingToken,
};
