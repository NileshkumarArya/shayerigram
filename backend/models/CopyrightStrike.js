const mongoose = require('mongoose');

// Audit trail for copyright strikes — one record per actioned copyright
// report, so both the user and admin have a history of what triggered
// each strike (not just a bare counter on User.js).
const CopyrightStrikeSchema = new mongoose.Schema(
  {
    user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    report:     { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
    targetType: { type: String, enum: ['post', 'story', 'chapter'], required: true },
    targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    issuedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Dispute flow — content owner can claim "this isn't copied content".
    // 'pending' excludes the strike from the active count while an admin
    // reviews it (not an automatic dismissal). 'overturned' excludes it
    // permanently and restores the taken-down content; 'upheld' puts it
    // back into the active count.
    disputeStatus: {
      type: String,
      enum: ['none', 'pending', 'upheld', 'overturned'],
      default: 'none',
    },
    disputeReason:     { type: String, maxlength: 500, default: '' },
    disputeResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disputeResolvedAt: { type: Date },
  },
  { timestamps: true }
);

CopyrightStrikeSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CopyrightStrike', CopyrightStrikeSchema);