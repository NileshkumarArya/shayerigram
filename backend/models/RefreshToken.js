const mongoose = require('mongoose');

/**
 * RefreshToken — stored in DB for session tracking + revocation
 * Enables: logout all devices, detect stolen tokens, session list
 */
const refreshTokenSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token:     { type: String, required: true, unique: true }, // hashed
  deviceId:  { type: String },              // fingerprint
  userAgent: { type: String },
  ip:        { type: String },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },               // null = active
  lastUsedAt:{ type: Date },
}, { timestamps: true });

refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
