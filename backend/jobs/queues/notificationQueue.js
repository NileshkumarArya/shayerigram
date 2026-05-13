/**
 * Notification Queue — BullMQ
 * Only plain serializable data goes into the queue.
 * NO: io, req, res, socket, Mongoose documents
 */
const { Queue } = require('bullmq');
const logger    = require('../../utils/logger');

const connection = process.env.REDIS_URL ? { url: process.env.REDIS_URL } : null;

let notificationQueue = null;

if (connection) {
  notificationQueue = new Queue('notifications', {
    connection,
    defaultJobOptions: {
      attempts:          3,
      backoff:           { type: 'exponential', delay: 3000 },
      removeOnComplete:  1000,
      removeOnFail:      5000,
    },
  });
  logger.info('Notification queue initialized');
} else {
  logger.warn('REDIS_URL not set — notification queue disabled, direct DB fallback active');
}

const enqueueNotification = async (payload) => {
  // Validate — only plain strings
  const safe = {
    recipientId: String(payload.recipientId),
    actorId:     String(payload.actorId),
    type:        String(payload.type),
    entityId:    payload.entityId ? String(payload.entityId) : undefined,
    postId:      payload.postId   ? String(payload.postId)   : undefined,
  };

  if (notificationQueue) {
    return notificationQueue.add('create-notification', safe);
  }

  // Fallback: direct DB write if Redis not available
  try {
    const Notification = require('../../models/Notification');
    await Notification.create({
      recipient: safe.recipientId,
      actor:     safe.actorId,
      type:      safe.type,
      entity:    safe.entityId,
      post:      safe.postId,
      read:      false,
    });
    logger.info('Notification created via direct fallback', { type: safe.type });
  } catch (e) {
    logger.error('Notification fallback failed', { error: e.message });
  }
};

module.exports = { notificationQueue, enqueueNotification };
