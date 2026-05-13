/**
 * Email Worker — processes email queue jobs
 * Run separately: node jobs/workers/emailWorker.js
 */
require('dotenv').config();
const sendEmail = require('../../utils/sendEmail');
const logger    = require('../../utils/logger');

const startEmailWorker = async () => {
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not set — email worker not started');
    return;
  }

  const { Worker } = require('bullmq');
  const worker = new Worker('email', async (job) => {
    logger.info('Processing email job', { jobId: job.id, to: job.data.to });
    await sendEmail(job.data);
    logger.info('Email sent', { jobId: job.id, to: job.data.to });
  }, {
    connection: { url: process.env.REDIS_URL },
    concurrency: 5,
  });

  worker.on('failed', (job, err) => {
    logger.error('Email job failed', { jobId: job?.id, error: err.message });
  });

  worker.on('completed', (job) => {
    logger.info('Email job completed', { jobId: job.id });
  });

  logger.info('📧 Email worker started');
  return worker;
};

// Run directly if called as script
if (require.main === module) {
  startEmailWorker().catch(console.error);
}

module.exports = { startEmailWorker };
