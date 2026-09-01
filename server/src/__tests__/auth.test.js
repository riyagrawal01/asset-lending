'use strict';

/**
 * M03 authentication tests.
 *
 * Covers:
 *  - registration: success, duplicate email, short password, MEMBER-only role
 *  - login: success, wrong password, unknown email
 *  - JWT middleware: valid token, missing token, bad token
 *  - requireRole: correct role passes, wrong role blocked
 *  - GET /api/auth/me: authenticated and unauthenticated
 */

const request = require('supertest');
const app = require('../app');
const { setupDB, teardownDB, clearDB } = require('./helpers');

// Use a fixed JWT_SECRET in tests so tokens are predictable
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.MONGODB_URI = 'set-by-memory-server';

beforeAll(async () => {
  await setupDB();
});
afterAll(async () => {
  await teardownDB();
});
beforeEach(async () => {
  await clearDB();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_USER = {
  name: 'Alice Member',
  email: 'alice@example.com',
  password: 'password123',
};

async function registerAndLogin(userData = VALID_USER) {
  await request(app).post('/api/auth/register').send(userData);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: userData.email, password: userData.password });
  return res.body.token;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  it('creates a MEMBER account and returns user without passwordHash', async () => {
    const res = await request(app).post('/api/auth/register').send(VALID_USER);
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('MEMBER');
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('does not log in automatically — returns no token', async () => {
    const res = await request(app).post('/api/auth/register').send(VALID_USER);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
  });

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
    const res = await request(app).post('/api/auth/register').send(VALID_USER);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...VALID_USER, password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects missing name with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@a.com', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('always creates MEMBER even if role:LIBRARIAN is sent', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...VALID_USER, role: 'LIBRARIAN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('MEMBER');
  });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
  });

  it('returns a token and user on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 on wrong password with generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    // Generic message — must not say "wrong password" or "not found"
    expect(res.body.error.message).toMatch(/invalid email or password/i);
  });

  it('returns 401 on unknown email with same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid email or password/i);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// JWT authentication middleware
// ---------------------------------------------------------------------------

describe('authenticate middleware (GET /api/auth/me)', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns the current user for a valid token', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.body.user.role).toBe('MEMBER');
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// requireRole middleware
// ---------------------------------------------------------------------------

describe('requireRole middleware', () => {
  // Use a minimal isolated Express app so we can add routes without
  // conflicting with the production app`s 404 handler.
  const express = require('express');
  const { authenticate, requireRole } = require('../middleware/auth');

  const testApp = express();
  testApp.use(express.json());
  testApp.get(
    '/librarian-only',
    authenticate,
    requireRole('LIBRARIAN'),
    (_req, res) => res.json({ ok: true })
  );
  // Error handler for the test app
  testApp.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: { code: err.code, message: err.message } });
  });


  it('allows LIBRARIAN to access a LIBRARIAN-only route', async () => {
    // Seed a librarian directly through the model (registration always creates MEMBER)
    const { User, ROLES } = require('../models/User');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const lib = await User.create({
      name: 'Lib User',
      email: 'lib@example.com',
      passwordHash: await bcrypt.hash('password123', 12),
      role: ROLES.LIBRARIAN,
    });
    const token = jwt.sign(
      { sub: lib._id.toString(), role: lib.role },
      process.env.JWT_SECRET,
      { expiresIn: '3d' }
    );
    const res = await request(testApp)
      .get('/librarian-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('blocks MEMBER from accessing a LIBRARIAN-only route with 403', async () => {
    const token = await registerAndLogin();
    const res = await request(testApp)
      .get('/librarian-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks unauthenticated requests with 401', async () => {
    const res = await request(testApp).get('/librarian-only');
    expect(res.status).toBe(401);
  });
});


