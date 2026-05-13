const mongoose = require('mongoose');

/**
 * Follow Collection — Separate from User
 * Instead of User.followers[] + User.following[] (unbounded arrays)
 * 
 * Scales to: millions of follow relationships
 * Counters: User.followersCount + User.followingCount (atomic $inc)
 * 
 * Index tradeoffs:
 * - 3 compound indexes = more write overhead BUT dramatically faster reads
 * - At 100k users with avg 200 follows = 20M documents — arrays would kill performance
 */
const followSchema = new mongoose.Schema(
  {
    followerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    followingId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Unique: can't follow same person twice
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// "Who follows user X" — for followers list + count verification
followSchema.index({ followingId: 1, createdAt: -1 });
// "Who does user X follow" — for following list + feed query
followSchema.index({ followerId: 1, createdAt: -1 });

module.exports = mongoose.model('Follow', followSchema);
