// ✅ DOTENV MUST BE FIRST — before any other require that reads process.env
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const mongoose   = require('mongoose');
const cookieParser = require('cookie-parser');

// ── Startup env validation (must fail fast before anything else) ─────────────
const { validateEnv } = require('./utils/validateEnv');
validateEnv();

// ── All other imports (env is now loaded + validated) ────────────────────────
const connectDB  = require('./config/db');
const { connectCache } = require('./utils/cache');
const { securityHeaders, mongoSanitize, allowedOrigins, cookieName } = require('./middleware/security');
const { generalLimiter } = require('./middleware/rateLimiter');
const { initSocket }     = require('./config/socket');
const { initSentry, sentryErrorHandler, captureError } = require('./config/sentry');
const { attachRequestId, requestLogger, detectSuspiciousRequest, trackIpReputation } = require('./middleware/requestIntegrity');
const { blockScrapers, addRobotsHeader } = require('./middleware/antiScraping'); // ✅ FIX 6
const { initEmailQueue }        = require('./jobs/queues/emailQueue');
const { notificationQueue } = require('./jobs/queues/notificationQueue');
const logger = require('./utils/logger');

connectDB();
connectCache().catch(err => logger.warn("Cache init failed", { error: err.message }));

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  pingTimeout:  30000,
  pingInterval: 15000,
});

// ── Sentry (must be before other middleware) ──────────────────────────────────
initSentry(app);

// ── Security headers ──────────────────────────────────────────────────────────
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOriginSet = new Set(allowedOrigins);
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOriginSet.has(origin) ? cb(null, true) : cb(new Error('CORS not allowed'))),
  credentials: true,
}));

// ── Request tracing + bot detection ──────────────────────────────────────────
app.use(attachRequestId);
app.use(requestLogger);
app.use(detectSuspiciousRequest);
app.use(trackIpReputation);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api', generalLimiter);
app.use('/api', blockScrapers);   // ✅ FIX 6: Block scrapers on all API routes
app.use('/api', addRobotsHeader); // ✅ FIX 6: Tell crawlers not to index API responses

// ── Body parsing ──────────────────────────────────────────────────────────────
// ✅ Preserve raw body for Razorpay webhook BEFORE express.json()
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook/razorpay') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      req.rawBody = data;
      try { req.body = JSON.parse(data); } catch { req.body = {}; }
      next();
    });
  } else {
    next();
  }
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ✅ cookie-parser MUST be registered for refresh token cookies to work
app.use(cookieParser());

// ── NoSQL sanitization ────────────────────────────────────────────────────────
app.use(mongoSanitize({ replaceWith: '_' }));

// ── Origin check for mutating requests ───────────────────────────────────────
app.use((req, res, next) => {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!mutating) return next();
  const origin = req.headers.origin;
  // Fail CLOSED — missing Origin on a mutating request is rejected, not waved through.
  // Legit mobile/server-to-server clients should use a bearer token, not cookies, anyway.
  if (!origin) {
    logger.warn('Mutating request with no Origin header blocked', { ip: req.ip, path: req.path });
    return res.status(403).json({ message: 'Origin required.' });
  }
  if (!allowedOriginSet.has(origin)) {
    logger.warn('Origin blocked', { origin, ip: req.ip, path: req.path });
    return res.status(403).json({ message: 'Origin not allowed.' });
  }
  next();
});

app.set('io', io);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/blocks',        require('./routes/blocks'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/posts',         require('./routes/posts'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/explore',       require('./routes/explore'));
app.use('/api/stories',       require('./routes/stories'));
app.use('/api/chapters',      require('./routes/chapters'));
app.use('/api/clubs',         require('./routes/clubs'));
app.use('/api/analytics',     require('./routes/analytics'));
app.use('/api/admin',         require('./routes/admin'));
// ─── Phase 1: Payments/Coins DISABLED — enable in Phase 2 ────────────────────
// Set ENABLE_PAYMENTS=true in .env when ready to go live with payments
if (process.env.ENABLE_PAYMENTS === 'true' && process.env.ENABLE_COINS === 'true') {
  app.use('/api/payment', require('./routes/payment'));
  logger.info('Payment routes ENABLED');
} else {
  app.use('/api/payment', (req, res) => res.status(503).json({
    message: 'Payment system not available in Phase 1.',
    code: 'PAYMENTS_DISABLED',
  }));
  logger.info('Payment routes DISABLED (Phase 1)');
}
app.post('/api/ads/event',    require('./middleware/auth').optionalAuth, require('./services/adService').trackAdEvent);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status:    'ok',
    uptime:    `${Math.floor(process.uptime())}s`,
    db:        ['disconnected','connected','connecting','disconnecting'][mongoose.connection.readyState] || 'unknown',
    memory:    `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
    timestamp: new Date().toISOString(),
  });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
initSocket(io);

// ── Sentry error handler (before custom error handler) ───────────────────────
app.use(sentryErrorHandler());

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  captureError(err, { method: req.method, path: req.path, userId: req.user?._id });
  logger.error('Request error', { method: req.method, path: req.path, error: err.message });
  res.status(err.status || 500).json({
    message: err.status ? err.message : 'Something went wrong. Please try again.',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => logger.info('ShayeriGram server started', { port: String(PORT) }));

// ── Queue workers ─────────────────────────────────────────────────────────────
initEmailQueue().catch(err => logger.warn('Email queue init failed', { error: err.message }));
if (notificationQueue) logger.info('Notification queue ready');

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received — shutting down`);
  server.close(async () => {
    try { await mongoose.connection.close(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('uncaughtException',  err => { logger.error('Uncaught exception', { error: err.message }); process.exit(1); });
process.on('unhandledRejection', err => { logger.error('Unhandled rejection', { error: String(err) }); });
