const crypto      = require('crypto');
const User        = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, REFRESH_TOKEN_EXPIRY, generateTwoFactorPendingToken } = require('../utils/tokenService');
const { enqueueEmail } = require('../jobs/queues/emailQueue');
const logger      = require('../utils/logger');
const { sanitizeString, authCookieOptions, cookieName } = require('../middleware/security');
const { isUnder13 } = require('../utils/age');

const POLICY_VERSION    = '2026-04-13';
const EMAIL_ACCOUNT_LIMIT = 3; // Ek email se max kitne accounts

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

// ─── Issue auth response ───────────────────────────────────────────────────────
const issueAuthResponse = async (res, user, statusCode = 200, req = null) => {
  const accessToken = generateAccessToken(user._id);

  res.cookie(cookieName, accessToken, authCookieOptions);

  if (req) {
    try {
      const existingRefreshToken = req.cookies?.refreshToken;
      if (existingRefreshToken) {
        const hashedExisting = crypto
          .createHash('sha256')
          .update(existingRefreshToken)
          .digest('hex');

        await RefreshToken.findOneAndUpdate(
          { token: hashedExisting, revokedAt: { $exists: false } },
          { $set: { revokedAt: new Date(), lastUsedAt: new Date() } }
        );
      }

      const refreshRaw = await generateRefreshToken(user._id, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        deviceId: req.headers['x-device-id'],
      });

      const isCrossDomain = String(process.env.CROSS_DOMAIN) === 'true';
      const isProd = process.env.NODE_ENV === 'production';

      const refreshCookieOptions = {
        httpOnly: true,
        secure: isProd || isCrossDomain,
        sameSite: isCrossDomain ? 'none' : 'lax',
        maxAge: REFRESH_TOKEN_EXPIRY * 1000,
        path: '/api/auth',
      };

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProd || isCrossDomain,
        sameSite: isCrossDomain ? 'none' : 'lax',
        path: '/api/auth/refresh',
      });

      res.cookie('refreshToken', refreshRaw, refreshCookieOptions);
        } catch (err) {
      logger.error('Refresh token creation failed', { userId: user._id, error: err.message });

      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: authCookieOptions.secure,
        sameSite: authCookieOptions.sameSite,
        path: authCookieOptions.path || '/',
      });

      return res.status(500).json({ message: 'Could not start secure session. Please try again.' });
    }
  }

  return res.status(statusCode).json({ user: safeUser(user) });
};

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
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

    // ─── Username uniqueness + email account limit — independent checks, run together ─
    const [usernameExists, emailCount] = await Promise.all([
      User.findOne({ username }),
      User.countDocuments({ email, isDeleted: { $ne: true } }),
    ]);
    if (usernameExists)
      return res.status(400).json({
        message: 'Unable to create account with provided details. Please try different credentials.',
      });

    // FIX 4: Email account limit — ek email se max EMAIL_ACCOUNT_LIMIT accounts
    if (emailCount >= EMAIL_ACCOUNT_LIMIT) {
      return res.status(400).json({
        message: `This email already has ${EMAIL_ACCOUNT_LIMIT} accounts. Maximum limit reached.`,
      });
    }

    // Age gate — never treat "missing" as "pass". validate.js should already
    // reject an absent dateOfBirth, but this controller re-checks independently
    // rather than assuming that layer ran (defense in depth, not single point of trust).
    const { dateOfBirth } = req.body;
    if (!dateOfBirth) {
      return res.status(400).json({ message: 'Date of birth is required.' });
    }
    if (isUnder13(dateOfBirth)) {
      return res.status(400).json({ message: 'You must be at least 13 years old to register.' });
    }

    const user = await User.create({
      username, email, password, fullName,
      dateOfBirth: new Date(dateOfBirth),
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

exports.issueAuthResponse = issueAuthResponse;

// ─── Login ────────────────────────────────────────────────────────────────────
// FIX 3: `identifier` accept karo — email ya username dono chalega
exports.login = async (req, res) => {
  try {
    const rawIdentifier = req.body.identifier ?? req.body.email; // backward compat
    if (typeof rawIdentifier !== 'string' || typeof req.body.password !== 'string')
      return res.status(400).json({ message: 'Invalid credentials.' });

    const identifier = sanitizeString(rawIdentifier, 254)?.toLowerCase();
    const password   = req.body.password;

    if (!identifier) return res.status(400).json({ message: 'Invalid credentials.' });

    // Email ya username? @ se detect karo
    const isEmail = identifier.includes('@');

    let user = null;

    if (isEmail) {
      // Email se login — multiple accounts ho sakti hain, password match karo
      const candidates = await User.find({ email: identifier, isDeleted: { $ne: true } })
        .select('+password +failedLoginAttempts +lockUntil +knownIps');

            // Find the first non-suspended, non-locked candidate whose password matches.
      // Failed-attempt counters are only applied AFTER the full loop, and only if
      // NO candidate matched — otherwise a correct login on account B would also
      // penalize an unrelated sibling account A that shares the same email.
      const attemptedCandidates = [];
      for (const candidate of candidates) {
        if (candidate.isSuspended) continue;
        if (candidate.isLocked?.()) continue;

        const match = await candidate.matchPassword(password);
        if (match) {
          user = candidate;
          break;
        }
        attemptedCandidates.push(candidate);
      }

      if (!user) {
        attemptedCandidates.forEach(c => {
          if (c.incrementFailedLogin) c.incrementFailedLogin().catch(() => {});
        });
      }

      // Agar koi match nahi — locked ya suspended check karo for specific error
      if (!user) {
        const lockedUser = candidates.find(c => c.isLocked?.());
        if (lockedUser) {
          const mins = Math.ceil(((lockedUser.lockUntil || 0) - Date.now()) / 60000);
          return res.status(423).json({
            message: `Account temporarily locked. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
          });
        }
        const suspendedUser = candidates.find(c => c.isSuspended);
        if (suspendedUser) {
          return res.status(403).json({ message: 'This account has been suspended.' });
        }
      }
    } else {
      // Username se login — unique hai, direct lookup
      user = await User.findOne({ username: identifier, isDeleted: { $ne: true } })
        .select('+password +failedLoginAttempts +lockUntil +knownIps');

      if (user?.isLocked?.()) {
        const mins = Math.ceil(((user.lockUntil || 0) - Date.now()) / 60000);
        logger.warn('Locked account login attempt', { identifier, ip: req.ip });
        return res.status(423).json({
          message: `Account temporarily locked. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
        });
      }

      if (user?.isSuspended)
        return res.status(403).json({ message: 'This account has been suspended.' });

            const passwordMatch = user ? await user.matchPassword(password) : false;
      if (!passwordMatch) {
        if (user?.incrementFailedLogin) {
          user.incrementFailedLogin().catch(() => {});
        }
        user = null;
      }
    }

    if (!user) {
      logger.warn('Failed login', { identifier, ip: req.ip });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Reset failed attempts
    if (user.resetFailedLogin) {
      user.resetFailedLogin().catch(() => {});
    }

    // Track login IP
    const currentIp = req.ip;
    const knownIps  = user.knownIps || [];
    const isNewIp   = knownIps.length > 0 && !knownIps.includes(currentIp);
    if (isNewIp) {
      logger.warn('Login from new IP', { username: user.username, newIp: currentIp });
    }

    User.findByIdAndUpdate(user._id, {
      $set:  { lastLoginAt: new Date(), lastLoginIp: currentIp },
      $push: { knownIps: { $each: [currentIp], $slice: -10 } },
    }).catch(() => {});

    if (user.twoFactorEnabled) {
      const tempToken = generateTwoFactorPendingToken(user._id);
      logger.info('Login password OK, awaiting 2FA', { username: user.username, ip: req.ip });
      return res.json({ requiresTwoFactor: true, tempToken });
    }

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
    if (!user) return res.status(401).json({ message: 'Session invalid. Please log in again.' });
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ message: 'Failed to fetch user.' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
// Logout is handled by middleware/auth.revokeCurrentDevice.
// Keep logout cookie clearing centralized so refresh tokens are revoked correctly.


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
    // Multiple accounts possible — resend for all unverified
    const users = await User.find({ email, isEmailVerified: false, isDeleted: { $ne: true } })
      .select('+emailVerifyToken +emailVerifyExpires');
    if (!users.length) return res.json({ message: GENERIC });

    for (const user of users) {
      const verifyToken = user.createEmailVerifyToken();
      await user.save();
      const verifyUrl = `${buildAppUrl()}/verify-email?token=${verifyToken}`;
      enqueueEmail({
        to: user.email, subject: 'Verify your ShayeriGram email',
        text: `Verify: ${verifyUrl}`,
        html: `<p>Account <strong>@${user.username}</strong>: <a href="${verifyUrl}">Verify Email</a></p>`,
      }).catch(() => {});
    }
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

    const users = await User.find({ email, isDeleted: { $ne: true } })
      .select('+passwordResetToken +passwordResetExpires');
    if (!users.length) return res.json({ message: GENERIC });

    for (const user of users) {
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
            <p>Account: <strong>@${user.username}</strong></p>
            <a href="${resetUrl}" style="display:inline-block;background:#9333ea;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Reset Password</a>
            <p style="color:#888;font-size:12px">Expires in 30 minutes.</p>
          </div>`,
      }).catch(err => logger.warn('Reset email failed', { error: err.message }));
    }

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