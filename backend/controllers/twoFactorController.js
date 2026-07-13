const speakeasy = require('speakeasy');
const qrcode    = require('qrcode');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const jwt       = require('jsonwebtoken');
const User      = require('../models/User');
const logger    = require('../utils/logger');
const { issueAuthResponse } = require('./authController');

// @POST /api/2fa/setup — generates a new secret + QR code. Nothing is saved
// yet; it only takes effect once confirmed via /enable with a real code.
exports.setupTwoFactor = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled.' });
    }

    const secret = speakeasy.generateSecret({ name: `ShayeriGram (${user.username})` });
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({ secret: secret.base32, qrDataUrl });
  } catch (err) {
    logger.error('2FA setup failed', { error: err.message, userId: req.user?._id });
    res.status(500).json({ message: 'Failed to start 2FA setup.' });
  }
};

// @POST /api/2fa/enable — confirms setup with a real code from the
// authenticator app, then turns 2FA on and issues one-time backup codes.
exports.enableTwoFactor = async (req, res) => {
  try {
    const { secret, code } = req.body;
    if (!secret || !code) {
      return res.status(400).json({ message: 'Secret and code are required.' });
    }

    const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
    if (!verified) {
      return res.status(400).json({ message: 'Invalid code. Please try again.' });
    }

    // 8 single-use backup codes, hashed like a password — shown once, never again
    const rawBackupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));
    const hashedBackupCodes = await Promise.all(rawBackupCodes.map((c) => bcrypt.hash(c, 10)));

    await User.findByIdAndUpdate(req.user._id, {
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: hashedBackupCodes,
    });

    logger.info('2FA enabled', { userId: req.user._id });
    res.json({ message: '2FA enabled.', backupCodes: rawBackupCodes });
  } catch (err) {
    logger.error('2FA enable failed', { error: err.message, userId: req.user?._id });
    res.status(500).json({ message: 'Failed to enable 2FA.' });
  }
};

// @POST /api/2fa/disable — requires password + a valid code, so a hijacked
// session alone can't silently turn off the user's own protection.
exports.disableTwoFactor = async (req, res) => {
  try {
    const { password, code } = req.body;
    const user = await User.findById(req.user._id).select('+password +twoFactorSecret +twoFactorBackupCodes');

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled.' });
    }
    if (!password || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    const validTotp = code && speakeasy.totp.verify({
      secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1,
    });
    let validBackup = false;
    if (!validTotp && code) {
      for (const hashed of user.twoFactorBackupCodes) {
        if (await bcrypt.compare(code, hashed)) { validBackup = true; break; }
      }
    }
    if (!validTotp && !validBackup) {
      return res.status(400).json({ message: 'Invalid code.' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [],
    });

    logger.info('2FA disabled', { userId: req.user._id });
    res.json({ message: '2FA disabled.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to disable 2FA.' });
  }
};

// @POST /api/2fa/verify-login — second step of login when 2FA is enabled.
// Deliberately NOT behind `protect` — at this point the user only has the
// short-lived pending token from step 1, not a real access token.
exports.verifyTwoFactorLogin = async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ message: 'Code is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    if (decoded.type !== '2fa_pending') {
      return res.status(401).json({ message: 'Invalid session.' });
    }

    const user = await User.findById(decoded.id).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user || !user.twoFactorEnabled) {
      return res.status(401).json({ message: 'Invalid session.' });
    }

    const validTotp = speakeasy.totp.verify({
      secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1,
    });

    let usedBackupIndex = -1;
    if (!validTotp) {
      for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
        if (await bcrypt.compare(code, user.twoFactorBackupCodes[i])) { usedBackupIndex = i; break; }
      }
    }
    if (!validTotp && usedBackupIndex === -1) {
      return res.status(401).json({ message: 'Invalid code.' });
    }

    if (usedBackupIndex !== -1) {
      user.twoFactorBackupCodes.splice(usedBackupIndex, 1);
      await user.save();
      logger.warn('2FA backup code used', { userId: user._id });
    }

    logger.info('2FA login verified', { userId: user._id });
    return issueAuthResponse(res, user, 200, req);
  } catch (err) {
    logger.error('2FA verify-login failed', { error: err.message });
    res.status(500).json({ message: 'Verification failed.' });
  }
};