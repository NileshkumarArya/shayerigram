/**
 * Notification Worker — BullMQ
 * Reads from notification queue → creates DB record → invalidates cache
 * Socket emit is handled separately (best-effort in request cycle)
 */
const { Worker }        = require('bullmq');
const Notification      = require('../../models/Notification');
const logger            = require('../../utils/logger');
const { invalidateCache } = require('../../utils/cache');
const cacheKeys         = require('../../utils/cacheKeys');

if (!process.env.REDIS_URL) {
  logger.warn('REDIS_URL not set — notification worker not started');
  module.exports = null;
  return;
}

const connection = { url: process.env.REDIS_URL };

const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { recipientId, actorId, type, entityId, postId } = job.data;

    const notification = await Notification.create({
      recipient: recipientId,
      actor:     actorId,
      type,
      entity:    entityId,
      post:      postId,
      read:      false,
    });

    // Invalidate unread count cache so next fetch is fresh
    await invalidateCache([cacheKeys.unreadNotifications(recipientId)]);

    logger.info('Notification created via worker', {
      notificationId: notification._id,
      recipientId,
      type,
    });

    return { notificationId: String(notification._id) };
  },
  {
    connection,
    concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 5),
  }
);

notificationWorker.on('failed', (job, err) => {
  logger.error('Notification job failed', { jobId: job?.id, error: err.message });
});

module.exports = notificationWorker;
