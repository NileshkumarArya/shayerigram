const crypto      = require('crypto');
const User        = require('../models/User');
const { generateAccessToken, generateRefreshToken, REFRESH_TOKEN_EXPIRY } = require('../utils/tokenService');
const { enqueueEmail } = require('../jobs/queues/emailQueue');
const logger      = require('../utils/logger');
const { sanitizeString, authCookieOptions, cookieName } = require('../middleware/security');

const POLICY_VERSION = '2026-04-13';

const buildAppUrl = () =>
  (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

// ─── safeUser — only public fields ────────────────────────────────────────────
const safeUser = (user) => ({
  _id:             user._id,
  username:        user.username,
  email:           user.email,
  fullName:        user.fullName,
  avatar:          user.avatar,
  bio:             user.bio,
  followersCount:  user.followersCount  || 0,
  followingCount:  user.followingCount  || 0,
  postsCount:      user.postsCount      || 0,
  savedCount:      user.savedCount      || 0,
  isVerified:      user.isVerified,
  isEmailVerified: user.isEmailVerified,
  isSuspended:     user.isSuspended,
  role:            user.role,
});

// ─── Issue auth response (access token + optional refresh token) ───────────────
const issueAuthResponse = async (res, user, statusCode = 200, req = null) => {
  const accessToken = generateAccessToken(user._id);

  // Set access token cookie
  res.cookie(cookieName, accessToken, authCookieOptions);

  // Set refresh token cookie (only if we have request context)
  if (req) {
    try {
      const refreshRaw = await generateRefreshToken(user._id, {
        ip:        req.ip,
        userAgent: req.headers['user-agent'],
        deviceId:  req.headers['x-device-id'],
      });
      // ✅ FIX: Match cross-domain logic from auth.js getRefreshCookieOptions
      const isCrossDomain = String(process.env.CROSS_DOMAIN) === 'true';
      const isProd        = process.env.NODE_ENV === 'production';
      res.cookie('refreshToken', refreshRaw, {
        httpOnly: true,
        secure:   isProd || isCrossDomain,
        sameSite: isCrossDomain ? 'none' : 'lax',
        maxAge:   REFRESH_TOKEN_EXPIRY * 1000,
        path:     '/api/auth/refresh',
      });
    } catch (err) {
      // Non-fatal — user still gets access token
      logger.warn('Refresh token creation failed', { userId: user._id, error: err.message });
    }
  }

  return res.status(statusCode).json({ user: safeUser(user) });
};

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  // Age gate check helper
  const isUnder13 = (dob) => {
    if (!dob) return false;
    const age = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
    return age < 13;
  };
  try {
    const username    = sanitizeString(req.body.username,  30)?.toLowerCase();
    const email       = sanitizeString(req.body.email,    254)?.toLowerCase();
    const password    = typeof req.body.password === 'string' ? req.body.password : '';
    const fullName    = sanitizeString(req.body.fullName,  50) || '';
    const acceptTerms = req.body.acceptTerms === true || req.body.acceptTerms === 'true';

    if (!username || !email || !password)
      return res.status(400).json({ message: 'Please provide all required fields.' });

    if (!acceptTerms)
      return res.status(400).json({ message: 'You must accept the Terms and Community Guidelines.' });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists)
      return res.status(400).json({
        message: 'Unable to create account with provided details. Please try different credentials.',
      });

    // Age gate — must be 13+
    const { dateOfBirth } = req.body;
    if (dateOfBirth && isUnder13(dateOfBirth)) {
      return res.status(400).json({ message: 'You must be at least 13 years old to register.' });
    }

    const user = await User.create({
      username, email, password, fullName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      termsAcceptedAt: new Date(),
      policyVersionAccepted: POLICY_VERSION,
    });

    // Email verification — fire and forget
    try {
      const verifyToken = user.createEmailVerifyToken();
      await user.save();
      const verifyUrl   = `${buildAppUrl()}/verify-email?token=${verifyToken}`;
      enqueueEmail({
        to:      user.email,
        subject: 'Verify your ShayeriGram email',
        text:    `Verify your email: ${verifyUrl}`,
        html:    `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#9333ea">Welcome to ShayeriGram ✦</h2>
            <p>Please verify your email to complete signup:</p>
            <a href="${verifyUrl}" style="display:inline-block;background:#9333ea;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Verify Email</a>
            <p style="color:#888;font-size:12px">Expires in 24 hours.</p>
          </div>`,
      }).catch(() => {});
    } catch {}

    logger.info('User registered', { username: user.username, ip: req.ip });
    return issueAuthResponse(res, user, 201, req);
  } catch (err) {
    logger.error('Register failed', { error: err.message, ip: req.ip });
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    if (typeof req.body.email !== 'string' || typeof req.body.password !== 'string')
      return res.status(400).json({ message: 'Invalid credentials.' });

    const email    = sanitizeString(req.body.email, 254)?.toLowerCase();
    const password = req.body.password;

    if (!email) return res.status(400).json({ message: 'Invalid credentials.' });

    // ✅ Single DB query — no populate needed (counters are denormalized)
    const user = await User.findOne({ email, isDeleted: { $ne: true } })
      .select('+password +failedLoginAttempts +lockUntil +knownIps');

    // Account locked (too many failed attempts)
    if (user?.isLocked?.()) {
      const mins = Math.ceil(((user.lockUntil || 0) - Date.now()) / 60000);
      logger.warn('Locked account login attempt', { email, ip: req.ip });
      return res.status(423).json({
        message: `Account temporarily locked. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
      });
    }

    // Account suspended
    if (user?.isSuspended)
      return res.status(403).json({ message: 'This account has been suspended.' });

    // Password check
    const passwordMatch = user ? await user.matchPassword(password) : false;

    if (!user || !passwordMatch) {
      // Increment failed attempts (non-blocking)
      if (user?.incrementFailedLogin) {
        user.incrementFailedLogin().catch(() => {});
      }
      logger.warn('Failed login', { email, ip: req.ip });
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // ✅ Reset failed attempts (non-blocking)
    if (user.resetFailedLogin) {
      user.resetFailedLogin().catch(() => {});
    }

    // ✅ Track login IP safely (non-blocking, fire-and-forget)
    const currentIp = req.ip;
    const knownIps  = user.knownIps || [];
    const isNewIp   = knownIps.length > 0 && !knownIps.includes(currentIp);

    if (isNewIp) {
      logger.warn('Login from new IP', { username: user.username, newIp: currentIp });
    }

    // Keep max 10 known IPs (sliding window)
    User.findByIdAndUpdate(user._id, {
      $set:      { lastLoginAt: new Date(), lastLoginIp: currentIp },
      $push:     { knownIps: { $each: [currentIp], $slice: -10 } },
    }).catch(() => {});

    logger.info('Login success', { username: user.username, ip: req.ip, newIp: isNewIp });
    return issueAuthResponse(res, user, 200, req);
  } catch (err) {
    logger.error('Login failed', { error: err.message });
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
};

// ─── Me ───────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    // ✅ FIX 3: Generic message — don't reveal whether user ID exists in DB
    if (!user) return res.status(401).json({ message: 'Session invalid. Please log in again.' });
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ message: 'Failed to fetch user.' });
  }
};

// ─── Logout (handled in auth middleware — just placeholder export) ─────────────
exports.logout = (req, res) => {
  // Real logout is in auth middleware: revokeCurrentDevice
  res.json({ message: 'Logged out.' });
};

// ─── Verify Email ─────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) return res.status(400).json({ message: 'Verification token is required.' });

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user   = await User.findOne({
      emailVerifyToken:   hashed,
      emailVerifyExpires: { $gt: new Date() },
    }).select('+emailVerifyToken +emailVerifyExpires');

    if (!user) return res.status(400).json({ message: 'Invalid or expired verification token.' });

    user.isEmailVerified    = true;
    user.emailVerifyToken   = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();
    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    logger.error('Verify email error', { error: err.message });
    res.status(500).json({ message: 'Could not verify email.' });
  }
};

// ─── Resend Verification ──────────────────────────────────────────────────────
exports.resendVerification = async (req, res) => {
  try {
    const email   = sanitizeString(req.body.email, 254)?.toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required.' });
    const GENERIC = 'If this email exists and is unverified, a verification link has been sent.';
    const user    = await User.findOne({ email }).select('+emailVerifyToken +emailVerifyExpires');
    if (!user || user.isEmailVerified) return res.json({ message: GENERIC });

    const verifyToken = user.createEmailVerifyToken();
    await user.save();
    const verifyUrl = `${buildAppUrl()}/verify-email?token=${verifyToken}`;
    enqueueEmail({
      to: user.email, subject: 'Verify your ShayeriGram email',
      text: `Verify: ${verifyUrl}`, html: `<p><a href="${verifyUrl}">Verify Email</a></p>`,
    }).catch(() => {});
    res.json({ message: GENERIC });
  } catch (err) {
    logger.error('Resend verify error', { error: err.message });
    res.status(500).json({ message: 'Could not resend verification email.' });
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const email   = sanitizeString(req.body.email, 254)?.toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required.' });
    const GENERIC = 'If this email exists, a password reset link has been sent.';
    const user    = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
    if (!user) return res.json({ message: GENERIC });

    const rawToken = user.createPasswordResetToken();
    await user.save();
    const resetUrl = `${buildAppUrl()}/reset-password?token=${rawToken}`;

    enqueueEmail({
      to:      user.email,
      subject: 'Reset your ShayeriGram password',
      text:    `Reset: ${resetUrl}`,
      html:    `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#9333ea">Password Reset ✦</h2>
          <p>Click below to reset your password:</p>
          <a href="${resetUrl}" style="display:inline-block;background:#9333ea;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Reset Password</a>
          <p style="color:#888;font-size:12px">Expires in 30 minutes.</p>
        </div>`,
    }).catch(err => logger.warn('Reset email failed', { error: err.message, resetUrl }));

    res.json({ message: GENERIC });
  } catch (err) {
    logger.error('Forgot password error', { error: err.message });
    res.status(500).json({ message: 'Could not process password reset.' });
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const token    = typeof req.body.token    === 'string' ? req.body.token    : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!token || !password)
      return res.status(400).json({ message: 'Token and password are required.' });

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user   = await User.findOne({
      passwordResetToken:   hashed,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password +passwordResetToken +passwordResetExpires');

    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token.' });

    user.password             = password;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts  = 0;
    user.lockUntil            = undefined;
    await user.save();

    logger.info('Password reset', { username: user.username });
    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    logger.error('Reset password error', { error: err.message });
    res.status(500).json({ message: 'Could not reset password.' });
  }
};
