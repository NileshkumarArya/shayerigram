const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

/**
 * User Model — Scalable Design
 * 
 * REMOVED (moved to separate collections):
 *   - followers[]    → Follow.followingId = userId
 *   - following[]    → Follow.followerId = userId
 *   - savedPosts[]   → Save.userId = userId
 * 
 * KEPT as counters (updated atomically via $inc):
 *   - followersCount, followingCount, savedCount, postsCount
 * 
 * Why: User doc was growing by adding IDs to arrays on every follow/save
 * MongoDB has a 16MB document limit — arrays kill large social accounts
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String, required: true, unique: true, trim: true,
      minlength: 3, maxlength: 30,
      match: [/^[a-zA-Z0-9_.]+$/, 'Invalid username'],
    },
    email: {
      type: String, required: true, unique: true, lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    password:       { type: String, required: true, minlength: 8, select: false },
    fullName:       { type: String, maxlength: 50, default: '' },
    bio:            { type: String, maxlength: 300, default: '' },
    avatar:         { type: String, default: '' },
    avatarPublicId: { type: String },
    website:        { type: String, maxlength: 200, default: '' },
    location:       { type: String, maxlength: 50, default: '' },

    // ✅ Denormalized counters — never recount by scanning collections
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    postsCount:     { type: Number, default: 0, min: 0 },
    savedCount:     { type: Number, default: 0, min: 0 },

    // Date of Birth — age gate 13+
    dateOfBirth: { type: Date, select: false },

    // Roles & Status
    role:        { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified:  { type: Boolean, default: false },   // Blue tick (manual grant)
    isPrivate:   { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },

    // Email verification
    isEmailVerified:    { type: Boolean, default: false },
    emailVerifyToken:   { type: String, select: false },
    emailVerifyExpires: { type: Date,   select: false },

    // Password reset
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },

    // Account lockout (brute force protection)
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil:           { type: Date },

    // Policy acceptance
    termsAcceptedAt:       { type: Date },
    policyVersionAccepted: { type: String, maxlength: 20 },
    // ─── Settings ─────────────────────────────────────────────────────────────
    settings: {
      profileVisibility: { type: String, enum: ["public", "private", "followers"], default: "public" },
      hideFromGuests:    { type: Boolean, default: false },
      disableComments:   { type: Boolean, default: false },
      notifyLikes:       { type: Boolean, default: true },
      notifyFollows:     { type: Boolean, default: true },
      notifyComments:    { type: Boolean, default: true },
      notifyDigest:      { type: Boolean, default: false },
      autosaveDrafts:    { type: Boolean, default: true },
      defaultLicense:    { type: String, enum: ["all_rights", "cc_by", "cc_by_sa", "cc0"], default: "all_rights" },
      allowSharing:      { type: Boolean, default: true },
      poetMode:          { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
// username + email already unique indexed by Mongoose
// Additional for suggestions/search
userSchema.index({ followersCount: -1 });     // Top creators discovery
userSchema.index({ createdAt: -1 });          // New users list
userSchema.index({ role: 1 });                // Admin queries

// ─── Password hashing ──────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// ─── Account lockout ──────────────────────────────────────────────────────
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incrementFailedLogin = async function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min
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

// ─── Email verification token ──────────────────────────────────────────────
userSchema.methods.createEmailVerifyToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.emailVerifyToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000;
  return rawToken;
};

// ─── Password reset token ──────────────────────────────────────────────────
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
