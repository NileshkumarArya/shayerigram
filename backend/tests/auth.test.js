/**
 * Auth Tests — v2 (identifier-based login)
 */
const request = require('supertest');
const express = require('express');

process.env.JWT_SECRET = 'test_secret_key_for_jest_minimum_32_chars_long';
process.env.NODE_ENV   = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.APP_URL    = 'http://localhost:5173';

jest.mock('../models/User');
jest.mock('../models/RefreshToken');
jest.mock('../utils/tokenService', () => ({
  generateAccessToken:  jest.fn(() => 'mock_access_token'),
  generateRefreshToken: jest.fn().mockResolvedValue('mock_refresh_raw'),
  REFRESH_TOKEN_EXPIRY: 2592000,
}));
jest.mock('../jobs/queues/emailQueue', () => ({
  enqueueEmail:   jest.fn().mockResolvedValue(true),
  initEmailQueue: jest.fn().mockResolvedValue(null),
}));
jest.mock('../jobs/queues/notificationQueue', () => ({
  enqueueNotification:   jest.fn().mockResolvedValue(true),
  initNotificationQueue: jest.fn().mockResolvedValue(null),
}));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

const makeChain = (result) => {
  const q = {
    result,
    select:   jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean:     jest.fn().mockReturnThis(),
    exec:     jest.fn().mockResolvedValue(result),
  };
  q.then  = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  q.catch = (fn) => Promise.resolve(result).catch(fn);
  return q;
};

const app = express();
app.use(express.json());
app.use(require('express-mongo-sanitize')());
app.use('/api/auth', require('../routes/auth'));

beforeEach(() => jest.clearAllMocks());

// ─── REGISTER ────────────────────────────────────────────────────────────────
describe('POST /api/auth/register — validation', () => {

  test('rejects missing all fields', async () => {
    const r = await request(app).post('/api/auth/register').send({});
    expect(r.status).toBe(400);
  });

  test('rejects invalid email', async () => {
    const r = await request(app).post('/api/auth/register')
      .send({ username: 'testuser', email: 'notanemail', password: 'Password123', acceptTerms: true });
    expect(r.status).toBe(400);
  });

  test('rejects password < 8 chars', async () => {
    const r = await request(app).post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@test.com', password: '123', acceptTerms: true });
    expect(r.status).toBe(400);
  });

  test('rejects username with spaces/symbols', async () => {
    const r = await request(app).post('/api/auth/register')
      .send({ username: 'bad user!', email: 'test@test.com', password: 'Password123', acceptTerms: true });
    expect(r.status).toBe(400);
  });

  test('rejects without ToS acceptance', async () => {
    const r = await request(app).post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@test.com', password: 'Password123', acceptTerms: false });
    expect(r.status).toBe(400);
  });

  test('rejects username too short', async () => {
    const r = await request(app).post('/api/auth/register')
      .send({ username: 'ab', email: 'test@test.com', password: 'Password123', acceptTerms: true });
    expect(r.status).toBe(400);
  });
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────
describe('POST /api/auth/login — validation', () => {

  test('rejects empty credentials', async () => {
    const r = await request(app).post('/api/auth/login').send({ identifier: '', password: '' });
    expect(r.status).toBe(400);
  });

  test('rejects missing password', async () => {
    const r = await request(app).post('/api/auth/login').send({ identifier: 'testuser' });
    expect(r.status).toBe(400);
  });

  test('returns 401 when username not found', async () => {
    const User = require('../models/User');
    User.findOne.mockReturnValueOnce(makeChain(null));
    const r = await request(app).post('/api/auth/login')
      .send({ identifier: 'notfounduser', password: 'Password123' });
    expect(r.status).toBe(401);
    expect(r.body.message).toContain('Invalid credentials');
  });

  test('returns 401 for wrong password', async () => {
    const User = require('../models/User');
    const mockUser = {
      _id:                  '507f191e810c19729de860ea',
      username:             'testuser',
      email:                'test@test.com',
      isSuspended:          false,
      isDeleted:            false,
      knownIps:             [],
      failedLoginAttempts:  0,
      isLocked:             () => false,
      matchPassword:        jest.fn().mockResolvedValue(false),
      incrementFailedLogin: jest.fn().mockResolvedValue(true),
      resetFailedLogin:     jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockReturnValueOnce(makeChain(mockUser));
    User.findByIdAndUpdate.mockResolvedValue({});

    const r = await request(app).post('/api/auth/login')
      .send({ identifier: 'testuser', password: 'wrongpassword' });
    expect(r.status).toBe(401);
  });

  test('returns 423 for locked account', async () => {
    const User = require('../models/User');
    const mockUser = {
      _id:       '507f191e810c19729de860ea',
      lockUntil: new Date(Date.now() + 60000),
      isLocked:  () => true,
    };
    User.findOne.mockReturnValueOnce(makeChain(mockUser));

    const r = await request(app).post('/api/auth/login')
      .send({ identifier: 'lockeduser', password: 'Password123' });
    expect(r.status).toBe(423);
  });

  test('returns 403 for suspended account', async () => {
    const User = require('../models/User');
    const mockUser = {
      _id:         '507f191e810c19729de860ea',
      isSuspended: true,
      isLocked:    () => false,
    };
    User.findOne.mockReturnValueOnce(makeChain(mockUser));

    const r = await request(app).post('/api/auth/login')
      .send({ identifier: 'suspendeduser', password: 'Password123' });
    expect(r.status).toBe(403);
  });
});

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {

  test('rejects invalid email', async () => {
    const r = await request(app).post('/api/auth/forgot-password').send({ email: 'bad' });
    expect(r.status).toBe(400);
  });

  test('returns generic 200 for missing user (enumeration prevention)', async () => {
    const User = require('../models/User');
    // Controller uses User.find (multiple accounts support)
    User.find.mockResolvedValueOnce([]);
    const r = await request(app).post('/api/auth/forgot-password').send({ email: 'nope@test.com' });
    expect(r.status).toBe(200);
    expect(r.body.message).toContain('If this email');
  });
});

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
describe('POST /api/auth/reset-password', () => {

  test('rejects missing token', async () => {
    const r = await request(app).post('/api/auth/reset-password').send({ password: 'newpass123' });
    expect(r.status).toBe(400);
  });

  test('rejects short password', async () => {
    const r = await request(app).post('/api/auth/reset-password').send({ token: 'abc', password: '123' });
    expect(r.status).toBe(400);
  });

  test('rejects invalid/expired token', async () => {
    const User = require('../models/User');
    User.findOne.mockReturnValueOnce(makeChain(null));
    const r = await request(app).post('/api/auth/reset-password')
      .send({ token: 'invalidtoken', password: 'NewPassword123' });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('Invalid or expired');
  });
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  test('always succeeds', async () => {
    const RefreshToken = require('../models/RefreshToken');
    RefreshToken.findOneAndUpdate.mockResolvedValue(null);
    const r = await request(app).post('/api/auth/logout');
    expect(r.status).toBe(200);
    expect(r.body.message).toContain('Logged out');
  });
});

// ─── REFRESH ──────────────────────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
  test('returns 401 when no refresh token', async () => {
    const r = await request(app).post('/api/auth/refresh');
    expect(r.status).toBe(401);
  });
});