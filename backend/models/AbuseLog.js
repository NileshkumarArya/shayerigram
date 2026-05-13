const mongoose = require('mongoose');

/**
 * AbuseLog — tracks suspicious behavior for risk scoring
 */
const abuseLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ip:        { type: String },
  action:    { type: String, required: true }, // 'rapid_like', 'spam_follow', etc.
  severity:  { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  riskScore: { type: Number, default: 0 },
  metadata:  { type: mongoose.Schema.Types.Mixed },
  resolved:  { type: Boolean, default: false },
}, { timestamps: true });

abuseLogSchema.index({ userId: 1, createdAt: -1 });
abuseLogSchema.index({ ip: 1, createdAt: -1 });
abuseLogSchema.index({ resolved: 1, severity: 1 });

module.exports = mongoose.model('AbuseLog', abuseLogSchema);
