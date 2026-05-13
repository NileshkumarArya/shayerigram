/**
 * Worker Process — runs separately from the main server
 *
 * Start:   node workers.js
 * Or:      npm run worker
 *
 * Deploy:  Run as a separate process/dyno/service alongside the main server
 *          Railway: add a second service pointing to this file
 *          Render:  add a Background Worker service
 */
require('dotenv').config();

const logger = require('./utils/logger');

// Connect DB for workers that need it
require('./config/db')();

// Start all workers
require('./jobs/workers/notificationWorker');
require('./jobs/workers/emailWorker');

logger.info('✅ Worker process started — notification + email workers active');
