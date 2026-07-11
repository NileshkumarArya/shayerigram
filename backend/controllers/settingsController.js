const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Follow       = require('../models/Follow');
const bcrypt       = require('bcryptjs');
const logger       = require('../utils/logger');
const { invalidateCache } = require('../utils/cache');
const { isUnder13 } = require('../utils/age');

const ALLOWED_SETTINGS = [
  'profileVisibility', 'hideFromGuests', 'disableComments',
  'notifyLikes', 'notifyFollows', 'notifyComments', 'notifyDigest',
  'autosaveDrafts', 'defaultLicense', 'allowSharing', 'poetMode',
];

// @GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('settings +dateOfBirth').lean();
    res.json({ settings: user.settings || {}, hasDateOfBirth: !!user.dateOfBirth });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get settings.' });
  }
};

// @PATCH /api/settings/date-of-birth — one-time set for accounts created
// before dateOfBirth was required at signup. Not a general "edit my
// birthday" endpoint — once set, self-service editing is blocked, since
// allowing repeated changes would let someone toggle their declared age
// back and forth around the 18+ mature-content gate.
exports.setDateOfBirth = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+dateOfBirth');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.dateOfBirth) {
      return res.status(400).json({
        message: 'Date of birth is already set and cannot be changed here. Contact support if it was entered incorrectly.',
      });
    }

    const { dateOfBirth } = req.body;
    if (!dateOfBirth) {
      return res.status(400).json({ message: 'Date of birth is required.' });
    }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime()) || dob > new Date()) {
      return res.status(400).json({ message: 'Invalid date of birth.' });
    }
    if (isUnder13(dateOfBirth)) {
      return res.status(400).json({ message: 'You must be at least 13 years old to use ShayeriGram.' });
    }

    user.dateOfBirth = dob;
    await user.save();

    logger.info('Date of birth set for existing account', { userId: user._id });
    res.json({ message: 'Date of birth saved.' });
  } catch (err) {
    logger.error('setDateOfBirth failed', { error: err.message, userId: req.user?._id });
    res.status(500).json({ message: 'Failed to update date of birth.' });
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

    const uid         = user._id.toString();
    const oldUsername = user.username;

    // Soft delete — anonymize PII
    user.isDeleted      = true;
    user.deletedAt      = new Date();
    user.isSuspended    = true;
    user.username       = `d_${uid}`;
    user.email          = `del_${uid}@deleted.shayerigram.com`;
    user.fullName       = '';
    user.bio            = '';
    user.avatar         = '';
    user.avatarPublicId = undefined;

    await user.save();

    // Jinko follow kiya tha unka followersCount kam karo
    const following = await Follow.find({ followerId: user._id }).lean();
    if (following.length > 0) {
      const followingIds = following.map(f => f.followingId);
      await User.updateMany(
        { _id: { $in: followingIds } },
        { $inc: { followersCount: -1 } }
      );
    }

    // Jo follow karte the unka followingCount kam karo
    const followers = await Follow.find({ followingId: user._id }).lean();
    if (followers.length > 0) {
      const followerIds = followers.map(f => f.followerId);
      await User.updateMany(
        { _id: { $in: followerIds } },
        { $inc: { followingCount: -1 } }
      );
    }

    // Saare follow records delete karo
    await Follow.deleteMany({
      $or: [{ followerId: user._id }, { followingId: user._id }]
    });

    // ✅ FIX: Cache clear karo — purana profile cache stale na rahe
    await invalidateCache([
      `user:profile:id:${user._id}`,
      `user:username:${oldUsername}`,
      ...following.map(f => `user:profile:id:${f.followingId}`),
      ...followers.map(f => `user:profile:id:${f.followerId}`),
    ]);

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