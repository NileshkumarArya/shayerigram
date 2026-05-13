const mongoose = require('mongoose');

/**
 * Payment — record of every payment attempt (before coins credited)
 * Backend creates this, then credits coins ONLY after webhook verification
 */
const paymentSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider:    { type: String, enum: ['razorpay', 'stripe', 'google_play', 'apple_iap'], required: true },
  orderId:     { type: String, required: true },    // Provider's order ID
  paymentId:   { type: String },                    // Provider's payment ID (after success)
  amount:      { type: Number, required: true },    // In smallest currency unit (paise/cents)
  currency:    { type: String, default: 'INR' },
  coinsToCredit: { type: Number, required: true },
  status:      { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  webhookVerified: { type: Boolean, default: false },
  processedAt:     { type: Date },
  failureReason:   { type: String },
  metadata:        { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

paymentSchema.index({ orderId: 1 }, { unique: true });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
