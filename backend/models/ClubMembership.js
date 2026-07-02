const mongoose = require('mongoose');

/**
 * ClubMembership — separate collection (Follow.js jaisa pattern)
 * role: 'admin' (creator) ya 'member'
 */
const clubMembershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    role:   { type: String, enum: ['member', 'admin'], default: 'member' },
  },
  { timestamps: true }
);

// Ek user ek club me sirf ek baar join kar sakta hai
clubMembershipSchema.index({ userId: 1, clubId: 1 }, { unique: true });
clubMembershipSchema.index({ clubId: 1, createdAt: -1 });
clubMembershipSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ClubMembership', clubMembershipSchema);