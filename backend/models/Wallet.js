const mongoose = require('mongoose');

/**
 * Wallet — user ka coin balance
 * RULE: Balance NEVER directly edited. Only via Transaction ledger + $inc
 * 
 * Double-spend prevention:
 *   - version field for optimistic locking
 *   - all debits check balance >= amount INSIDE transaction
 */
const walletSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0, min: 0 },   // Always >= 0
  lifetimeEarned:  { type: Number, default: 0 },    // Total ever earned (audit)
  lifetimeSpent:   { type: Number, default: 0 },    // Total ever spent (audit)
  version: { type: Number, default: 0 },            // Optimistic locking
}, { timestamps: true });


module.exports = mongoose.model('Wallet', walletSchema);
