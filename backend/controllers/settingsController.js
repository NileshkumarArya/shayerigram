const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const bcrypt       = require('bcryptjs');
const logger       = require('../utils/logger');

const ALLOWED_SETTINGS = [
  'profileVisibility', 'hideFromGuests', 'disableComments',
  'notifyLikes', 'notifyFollows', 'notifyComments', 'notifyDigest',
  'autosaveDrafts', 'defaultLicense', 'allowSharing', 'poetMode',
];

// @GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('settings').lean();
    res.json({ settings: user.settings || {} });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get settings.' });
  }
};

// @PUT /api/settings
exports.updateSettings = async (req, res) => {
  try {
    const updates = {};
    for (const key of ALLOWED_SETTINGS) {
      if (req.body[key] !== undefined) {
        updates[`settings.${key}`] = req.body[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid settings provided.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, select: 'settings' }
    );
    logger.info('Settings updated', { userId: req.user._id });
    res.json({ settings: user.settings, message: 'Settings saved.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update settings.' });
  }
};

// @POST /api/settings/deactivate
exports.deactivateAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Incorrect password.' });

    user.isSuspended = true;
    await user.save();

    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );

    res.clearCookie('refreshToken');
    res.json({ message: 'Account deactivated. You can reactivate by logging in.' });
  } catch (err) {
    logger.error('Deactivate account failed', { error: err.message, userId: req.user?._id });
    res.status(500).json({ message: 'Failed to deactivate account.' });
  }
};

// @DELETE /api/settings/account
exports.deleteAccount = async (req, res) => {
  try {
    const { password, confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({ message: 'Type DELETE to confirm.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Incorrect password.' });

    const uid = user._id.toString();

    // Soft delete — anonymize PII
    // NOTE: d_ prefix = 2 chars + 24 char ObjectId = 26 chars total (maxlength 30 ✅)
    user.isDeleted   = true;
    user.deletedAt   = new Date();
    user.isSuspended = true;
    user.username    = `d_${uid}`;                        // 26 chars — safe ✅
    user.email       = `del_${uid}@deleted.shayerigram.com`;
    user.fullName    = '';
    user.bio         = '';
    user.avatar      = '';
    user.avatarPublicId = undefined;

    await user.save();

    await RefreshToken.updateMany(
      { userId: user._id },
      { revokedAt: new Date() }
    );

    res.clearCookie('refreshToken');
    logger.warn('Account deleted', { userId: uid });
    res.json({ message: 'Account permanently deleted.' });
  } catch (err) {
    logger.error('Delete account failed', { error: err.message, userId: req.user?._id });
    res.status(500).json({ message: 'Failed to delete account.' });
  }
};