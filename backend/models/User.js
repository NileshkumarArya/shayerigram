const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

/**
 * User Model — Scalable Design
 *
 * REMOVED from document (moved to separate collections):
 *   - followers[]  → Follow collection
 *   - following[]  → Follow collection
 *   - savedPosts[] → Save collection
 *
 * Counters denormalized (updated via $inc):
 *   - followersCount, followingCount, savedCount, postsCount
 *
 * v7 changes:
 *   - email: unique index removed → multiple accounts per email allowed (max 3, enforced in controller)
 *   - isDeleted / deletedAt added for soft-delete
 *   - knownIps / lastLoginAt / lastLoginIp added (were referenced but missing)
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String, required: true, unique: true, trim: true,
      minlength: 3, maxlength: 30,
      match: [/^[a-zA-Z0-9_.]+$/, 'Invalid username'],
    },
    // NOTE: unique removed — multiple accounts per email allowed (limit enforced in authController)
    email: {
      type: String, required: true, lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    password:       { type: String, required: true, minlength: 8, select: false },
    fullName:       { type: String, maxlength: 50, default: '' },
    bio:            { type: String, maxlength: 300, default: '' },
    avatar:         { type: String, default: '' },
    avatarPublicId: { type: String },
    website:        { type: String, maxlength: 200, default: '' },
    location:       { type: String, maxlength: 50, default: '' },

    // Denormalized counters
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    postsCount:     { type: Number, default: 0, min: 0 },
    savedCount:     { type: Number, default: 0, min: 0 },
    storiesCount:   { type: Number, default: 0, min: 0 },

    dateOfBirth: { type: Date, required: [true, 'Date of birth is required'], select: false },

    role:        { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified:  { type: Boolean, default: false },
    isPrivate:   { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    copyrightStrikes: { type: Number, default: 0, min: 0 },

    // Optional 2FA — off by default, user opts in from Settings
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret:  { type: String, select: false },
    twoFactorBackupCodes: { type: [String], select: false, default: [] }, // bcrypt-hashed, single-use

    // Soft delete
    isDeleted:  { type: Boolean, default: false },
    deletedAt:  { type: Date },

    // Email verification
    isEmailVerified:    { type: Boolean, default: false },
    emailVerifyToken:   { type: String, select: false },
    emailVerifyExpires: { type: Date,   select: false },

    // Password reset
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },

    // Account lockout
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil:           { type: Date },

    // Login tracking
    lastLoginAt:  { type: Date },
    lastLoginIp:  { type: String },
    knownIps:     { type: [String], default: [], select: false },

    // Policy acceptance
    termsAcceptedAt:       { type: Date },
    policyVersionAccepted: { type: String, maxlength: 20 },

    // Settings
    settings: {
      profileVisibility: { type: String, enum: ['public', 'private', 'followers'], default: 'public' },
      hideFromGuests:    { type: Boolean, default: false },
      disableComments:   { type: Boolean, default: false },
      notifyLikes:       { type: Boolean, default: true },
      notifyFollows:     { type: Boolean, default: true },
      notifyComments:    { type: Boolean, default: true },
      notifyDigest:      { type: Boolean, default: false },
      autosaveDrafts:    { type: Boolean, default: true },
      defaultLicense:    { type: String, enum: ['all_rights', 'cc_by', 'cc_by_sa', 'cc0'], default: 'all_rights' },
      allowSharing:      { type: Boolean, default: true },
      poetMode:          { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// ─── Indexes ────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });               // Non-unique — fast lookup by email
userSchema.index({ followersCount: -1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1 });
userSchema.index({ isDeleted: 1 });           // Fast filter for soft-deleted accounts

// ─── Password hashing ───────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // Cost factor 11 (was 12) — chosen for Render's 0.1 vCPU free tier to
  // reduce per-login/signup CPU time. Still well within OWASP's "strong"
  // range. Revisit with an actual benchmark if the hosting tier changes.
  this.password = await bcrypt.hash(this.password, 11);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// ─── Account lockout ────────────────────────────────────────────────────────
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incrementFailedLogin = async function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
  }
  await this.save();
};

userSchema.methods.resetFailedLogin = async function () {
  if (this.failedLoginAttempts > 0 || this.lockUntil) {
    this.failedLoginAttempts = 0;
    this.lockUntil = undefined;
    await this.save();
  }
};

// ─── Email verification token ───────────────────────────────────────────────
userSchema.methods.createEmailVerifyToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.emailVerifyToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000;
  return rawToken;
};

// ─── Password reset token ───────────────────────────────────────────────────
userSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000;
  return rawToken;
};

// ─── Settings helper ──────────────────────────────────────────────────────
userSchema.methods.getSettings = function () {
  return this.settings || {};
};

module.exports = mongoose.model('User', userSchema);