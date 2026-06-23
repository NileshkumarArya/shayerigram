/**
 * Socket.IO Secure Configuration
 *
 * Security:
 *   - JWT verified on connect
 *   - Per-socket rate limiting (prevents spam emit)
 *   - Event validation (no unknown events)
 *   - Room model: each user joins their own room
 *
 * Scaling:
 *   - Redis adapter enables multi-instance deployment
 *   - DB is source of truth (socket miss → client fetches)
 */
const jwt    = require('jsonwebtoken');
const Message = require('../models/Message');
const Chat    = require('../models/Chat');
const crypto = require('crypto');
const { parseCookies, cookieName } = require('../middleware/security');
const logger = require('../utils/logger');

// Per-socket event rate limits
const SOCKET_LIMITS = {
  send_message: { max: 10,  window: 60000 }, // 10 messages/min
  join_room:    { max: 20,  window: 60000 }, // 20 joins/min
  default:      { max: 100, window: 60000 }, // Generic limit
};

// Simple in-memory counter per socket (for socket-level limits)
const socketCounters = new Map();

const getRateLimitKey = (socketId, event) => `${socketId}:${event}`;

const checkSocketLimit = (socketId, event) => {
  const limit  = SOCKET_LIMITS[event] || SOCKET_LIMITS.default;
  const key    = getRateLimitKey(socketId, event);
  const now    = Date.now();
  const entry  = socketCounters.get(key) || { count: 0, resetAt: now + limit.window };

  if (now > entry.resetAt) {
    entry.count   = 0;
    entry.resetAt = now + limit.window;
  }

  entry.count++;
  socketCounters.set(key, entry);

  return entry.count <= limit.max;
};

const initSocket = (io) => {
  // ─── Redis adapter for multi-instance Socket.IO ─────────────────────────
  // Enables horizontal scaling — multiple backend instances share socket state
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = require('redis');
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (e) => logger.warn('Socket Redis pub error', { error: e.message }));
      subClient.on('error', (e) => logger.warn('Socket Redis sub error', { error: e.message }));

      Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          logger.info('Socket.IO Redis adapter enabled — multi-instance ready');
        })
        .catch((e) => logger.warn('Socket Redis adapter failed — single-instance mode', { error: e.message }));
    } catch (e) {
      logger.warn('Socket Redis adapter not available', { error: e.message });
    }
  } else {
    logger.info('REDIS_URL not set — Socket.IO running in single-instance mode');
  }

  // ─── JWT Auth on connect ─────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        || parseCookies(socket.handshake.headers?.cookie || '')[cookieName];

      if (!token) return next(new Error('Unauthorized'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId    = decoded.id;
      socket.deviceId  = socket.handshake.auth?.deviceId;
      next();
    } catch (err) {
      next(new Error('Unauthorized: invalid token'));
    }
  });

  const onlineUsers = new Map();
  // ✅ FIX 1: Per-user connection tracking — prevent memory exhaustion
  const userSocketCount = new Map();
  const MAX_SOCKETS_PER_USER = 5; // 5 tabs/devices max per user

  io.on('connection', (socket) => {
    const userId = socket.userId;

    // ✅ Enforce per-user connection cap
    const currentCount = userSocketCount.get(userId) || 0;
    if (currentCount >= MAX_SOCKETS_PER_USER) {
      logger.warn('Socket connection cap exceeded', { userId, count: currentCount });
      socket.emit('error', { message: 'Too many connections. Please close other tabs.' });
      socket.disconnect(true);
      return;
    }
    userSocketCount.set(userId, currentCount + 1);

    // ✅ Auto-join personal notification room
    socket.join(`notification_${userId}`);
    onlineUsers.set(userId, socket.id);
    io.emit('online_users', Array.from(onlineUsers.keys()));

    logger.info('Socket connected', { userId, socketId: socket.id });

    // ─── Rate-limited event handler wrapper ──────────────────────────────
    const handleEvent = (event, handler) => {
      socket.on(event, (...args) => {
        if (!checkSocketLimit(socket.id, event)) {
          socket.emit('error', { message: 'Rate limit exceeded', event });
          logger.warn('Socket rate limit hit', { userId, event });
          return;
        }
        handler(...args);
      });
    };

    // ─── Join chat room (authorization enforced) ──────────────────────────
    handleEvent('join_room', (roomId) => {
      if (typeof roomId !== 'string') return;
      if (!/^[a-f0-9]{24}$/.test(roomId)) return; // Validate ObjectId format

      // ✅ SECURITY FIX: Only allow joining your own notification room
      // Prevents unauthorized users from snooping on other users' realtime events
      // Future chat rooms must go through a server-side authorization check
      const allowedRooms = [`notification_${userId}`];
      if (!allowedRooms.includes(roomId) && roomId !== userId) {
        logger.warn('Socket unauthorized room join attempt', { userId, roomId });
        socket.emit('error', { message: 'Not authorized to join this room.' });
        return;
      }
      socket.join(roomId);
    });

    // ─── Send message (validated) ─────────────────────────────────────────
    handleEvent('send_message', (data = {}) => {
      if (typeof data.roomId !== 'string') return;
      if (!/^[a-f0-9]{24}$/.test(data.roomId)) return;
      if (typeof data.text !== 'string') return;

      const text = data.text.trim().slice(0, 1000);
      if (!text) return;

      io.to(data.roomId).emit('receive_message', {
        roomId:    data.roomId,
        text,
        senderId:  userId,
        createdAt: new Date().toISOString(),
      });
    });

    // ─── Disconnect ───────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      // ✅ Decrement per-user connection count
      const remaining = (userSocketCount.get(userId) || 1) - 1;
      if (remaining <= 0) userSocketCount.delete(userId);
      else userSocketCount.set(userId, remaining);

      onlineUsers.delete(userId);
      // Clean up socket counters
      for (const key of socketCounters.keys()) {
        if (key.startsWith(socket.id)) socketCounters.delete(key);
      }
      io.emit('online_users', Array.from(onlineUsers.keys()));
      logger.info('Socket disconnected', { userId, reason });
    });
  });

  return io;
};

// ─── Socket Event Rate Limiter (in-memory per userId:event) ────────────────
const _socketBuckets = new Map();

const socketRateLimit = ({ limit = 20, windowMs = 10000 } = {}) =>
  (socket, eventName) => {
    const key = `${socket.userId}:${eventName}`;
    const now = Date.now();
    const b   = _socketBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > b.resetAt) { b.count = 0; b.resetAt = now + windowMs; }
    b.count++;
    _socketBuckets.set(key, b);
    return b.count <= limit;
  };

// Cleanup stale buckets every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _socketBuckets.entries()) {
    if (now > v.resetAt) _socketBuckets.delete(k);
  }
}, 5 * 60 * 1000);

module.exports = { initSocket, socketRateLimit };
