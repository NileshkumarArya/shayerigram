const mongoose = require('mongoose');

/**
 * Block Collection
 * blockerId blocks blockeeId
 * - Blocked user cannot see blocker's posts/profile
 * - Blocker cannot see blocked user's posts/profile
 */
const blockSchema = new mongoose.Schema(
  {
    blockerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    blockeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

blockSchema.index({ blockerId: 1, blockeeId: 1 }, { unique: true });
blockSchema.index({ blockeeId: 1 }); // "who blocked me" queries

module.exports = mongoose.model('Block', blockSchema);
