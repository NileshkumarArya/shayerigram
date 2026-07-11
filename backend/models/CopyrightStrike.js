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
  },
  { timestamps: true }
);

CopyrightStrikeSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CopyrightStrike', CopyrightStrikeSchema);