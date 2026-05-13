/**
 * Sentry Error Monitoring
 * 
 * Captures:
 *   - Unhandled exceptions
 *   - API errors (4xx/5xx)
 *   - Performance traces
 * 
 * Setup: set SENTRY_DSN in .env
 * Get DSN from: sentry.io → New Project → Node.js
 */
const logger = require('../utils/logger');

let Sentry = null;

const initSentry = (app) => {
  if (!process.env.SENTRY_DSN) {
    logger.warn('SENTRY_DSN not set — error monitoring disabled');
    return;
  }

  try {
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn:         process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      // Capture 100% in dev, 20% in production (cost control)
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      beforeSend(event) {
        // Don't send 401/403 errors (normal auth failures)
        if (event.tags?.statusCode === 401 || event.tags?.statusCode === 403) return null;
        return event;
      },
    });

    // Must be FIRST middleware
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());

    logger.info('Sentry error monitoring initialized');
  } catch (err) {
    logger.warn('Sentry init failed', { error: err.message });
  }
};

/**
 * Sentry error handler — must be AFTER all routes, BEFORE custom error handler
 */
const sentryErrorHandler = () => {
  if (Sentry) return Sentry.Handlers.errorHandler();
  return (err, req, res, next) => next(err); // passthrough if no Sentry
};

/**
 * Manually capture an error with context
 */
const captureError = (err, context = {}) => {
  logger.error('Application error', { error: err.message, ...context });
  if (Sentry) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(err);
    });
  }
};

module.exports = { initSentry, sentryErrorHandler, captureError };
