/**
 * Email Queue — fire-and-forget email sending
 * Moves email sending out of request cycle
 * Falls back to direct send if Redis unavailable
 */
const logger = require('../../utils/logger');

let emailQueue = null;

const initEmailQueue = async () => {
  // ✅ FIX: Render par abhi koi separate email-worker process deploy nahi hota —
  // jobs queue mein add ho jaate the but koi unhe consume nahi karta tha, isliye
  // forgot-password / verify-email jaisi emails silently kabhi bhejti hi nahi thi.
  // Same fix jo notificationQueue.js mein already hai: queue tabhi use karo jab
  // ENABLE_EMAIL_QUEUE=true ho (matlab worker actually deployed hai), warna
  // direct-send fallback use karo.
  if (process.env.ENABLE_EMAIL_QUEUE !== 'true' || !process.env.REDIS_URL) {
    logger.warn('Email queue disabled (set ENABLE_EMAIL_QUEUE=true once emailWorker.js is deployed) — using direct send');
    return null;
  }
  try {
    const { Queue } = require('bullmq');
    emailQueue = new Queue('email', {
      connection: { url: process.env.REDIS_URL },
      defaultJobOptions: {
        attempts:    3,
        backoff:     { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail:     50,
      },
    });
    logger.info('Email queue initialized');
    return emailQueue;
  } catch (err) {
    logger.warn('BullMQ init failed — direct email fallback', { error: err.message });
    return null;
  }
};

const enqueueEmail = async (data) => {
  if (emailQueue) {
    await emailQueue.add('send-email', data);
  } else {
    // Direct fallback — fire and forget
    const sendEmail = require('../../utils/sendEmail');
    sendEmail(data).catch(err => logger.warn('Direct email failed', { error: err.message }));
  }
};

module.exports = { initEmailQueue, enqueueEmail };
