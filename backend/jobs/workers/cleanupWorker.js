/**
 * Cleanup Worker — permanent deletion of soft-deleted content after 30 days
 * 
 * Run: node jobs/workers/cleanupWorker.js
 * Or: schedule with cron (runs daily at 3 AM)
 */
require('dotenv').config();
const mongoose   = require('mongoose');
const cloudinary = require('cloudinary').v2;
const logger     = require('../../utils/logger');

const RETENTION_DAYS = 30; // Keep deleted content for 30 days (recoverable)

const runCleanup = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info('Cleanup worker started');

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const Post   = require('../../models/Post');

  // Find posts soft-deleted > 30 days ago
  const oldDeleted = await Post
    .findWithDeleted({ isDeleted: true, deletedAt: { $lt: cutoff } })
    .select('_id imagePublicId')
    .lean();

  logger.info(`Found ${oldDeleted.length} posts to permanently delete`);

  let deleted = 0;
  for (const post of oldDeleted) {
    try {
      // Delete from Cloudinary
      if (post.imagePublicId) {
        await cloudinary.uploader.destroy(post.imagePublicId);
      }
      await Post.findByIdAndDelete(post._id);
      deleted++;
    } catch (err) {
      logger.error('Failed to cleanup post', { postId: post._id, error: err.message });
    }
  }

  logger.info(`Cleanup complete: ${deleted}/${oldDeleted.length} posts permanently deleted`);
  await mongoose.disconnect();
};

if (require.main === module) {
  runCleanup().catch((err) => {
    logger.error('Cleanup worker failed', { error: err.message });
    process.exit(1);
  });
}

module.exports = { runCleanup };
