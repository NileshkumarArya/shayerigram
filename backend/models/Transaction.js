const mongoose = require('mongoose');

/**
 * Transaction Ledger — immutable record of every coin movement
 *
 * RULES:
 *   - Never update a transaction (immutable)
 *   - type: credit = coins IN, debit = coins OUT
 *   - idempotencyKey prevents duplicate processing (e.g. webhook replay)
 *   - balance snapshot after this tx = audit trail
 */
const txSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:     { type: String, enum: ['credit', 'debit'], required: true },
  amount:   { type: Number, required: true, min: 1 },
  reason:   {
    type: String,
    enum: [
      'purchase',          // Bought coins (Razorpay/Stripe/IAP)
      'gift_received',     // Someone gifted you
      'gift_sent',         // You gifted someone
      'reward',            // Ad watch / daily reward
      'refund',            // Admin refund
      'admin_adjustment',  // Admin manual add/remove
      'subscription_bonus',// Premium subscription bonus
    ],
    required: true,
  },
  balanceAfter:     { type: Number, required: true },      // Snapshot after tx
  idempotencyKey:   { type: String, unique: true, sparse: true }, // Prevents replay
  referenceId:      { type: String },                      // Payment ID / Order ID
  referenceType:    { type: String, enum: ['payment', 'gift', 'reward', 'admin'] },
  metadata:         { type: mongoose.Schema.Types.Mixed }, // Extra info
  createdAt:        { type: Date, default: Date.now, immutable: true },
});

txSchema.index({ userId: 1, createdAt: -1 });
txSchema.index({ referenceId: 1 }, { sparse: true });

module.exports = mongoose.model('Transaction', txSchema);
