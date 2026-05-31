/**
 * Notification Queue — BullMQ
 * Only plain serializable data goes into the queue.
 * NO: io, req, res, socket, Mongoose documents
 */
const { Queue } = require('bullmq');
const logger    = require('../../utils/logger');

const shouldUseQueue =
  process.env.ENABLE_NOTIFICATION_QUEUE === 'true' &&
  Boolean(process.env.REDIS_URL);

const connection = shouldUseQueue ? { url: process.env.REDIS_URL } : null;

let notificationQueue = null;

if (connection) {
  notificationQueue = new Queue('notifications', {
    connection,
    defaultJobOptions: {
      attempts:         3,
      backoff:          { type: 'exponential', delay: 3000 },
      removeOnComplete: 1000,
      removeOnFail:     5000,
    },
  });

  notificationQueue.on('error', (err) => {
    logger.warn('Notification queue error', { error: err.message });
  });

  logger.info('Notification queue initialized');
} else {
  logger.info('Notification queue disabled — direct DB fallback active');
}

const enqueueNotification = async (payload) => {
  const safe = {
    recipientId: String(payload.recipientId),
    actorId:     String(payload.actorId),
    type:        String(payload.type),
    entityId:    payload.entityId ? String(payload.entityId) : undefined,
  };

  // ✅ FIX: Render par separate worker run nahi hota
  // Queue tabhi use karo jab ENABLE_NOTIFICATION_QUEUE=true ho
  if (process.env.ENABLE_NOTIFICATION_QUEUE === 'true' && notificationQueue) {
    return notificationQueue.add('create-notification', safe);
  }

  // Default: direct DB save
  try {
    const Notification = require('../../models/Notification');
    await Notification.create({
      recipientId: safe.recipientId,
      actorId:     safe.actorId,
      type:        safe.type,
      entityId:    safe.entityId,
      isRead:      false,
    });
    logger.info('Notification created directly', { type: safe.type });
  } catch (e) {
    logger.error('Notification create failed', { error: e.message });
  }
};

module.exports = { notificationQueue, enqueueNotification };