const mongoose = require('mongoose');

/**
 * Read Collection — one permanent record per (user, target) pair.
 * Used to dedupe totalReads counters so refreshing a Story/Chapter page
 * doesn't inflate the count — same pattern as Like.js / Follow.js / Bookmark.js.
 *
 * Anonymous (logged-out) readers have no stable userId, so they are NOT
 * tracked here — controllers fall back to a short-lived IP-based Redis key
 * for that case instead (see chapterController.js / storyController.js).
 */
const readSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['Story', 'Chapter'], required: true },
    targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

// Unique: one counted read per user per target, ever
readSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('Read', readSchema);