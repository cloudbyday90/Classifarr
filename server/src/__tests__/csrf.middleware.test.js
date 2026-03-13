/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const {
  ensureCsrfCookie,
  csrfProtection,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} = require('../middleware/csrf');

describe('CSRF Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use(ensureCsrfCookie);
    app.use(csrfProtection);

    app.get('/state', (req, res) => res.json({ success: true }));
    app.post('/state', (req, res) => res.json({ success: true }));
  });

  test('issues CSRF cookie for authenticated cookie sessions', async () => {
    const res = await request(app)
      .get('/state')
      .set('Cookie', ['access_token=token123']);

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'].some(c => c.startsWith(`${CSRF_COOKIE_NAME}=`))).toBe(true);
  });

  test('allows mutating requests without cookie auth', async () => {
    const res = await request(app).post('/state').send({ test: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('rejects mutating cookie-auth requests without CSRF header', async () => {
    const res = await request(app)
      .post('/state')
      .set('Cookie', ['access_token=token123']);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF validation failed');
  });

  test('rejects mutating cookie-auth requests with invalid CSRF token', async () => {
    const res = await request(app)
      .post('/state')
      .set('Cookie', ['access_token=token123', `${CSRF_COOKIE_NAME}=validtoken`])
      .set('X-CSRF-Token', 'invalidtoken');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF validation failed');
  });

  test('allows mutating cookie-auth requests with valid CSRF token', async () => {
    const csrfToken = 'validtoken123';
    const res = await request(app)
      .post('/state')
      .set('Cookie', ['access_token=token123', `${CSRF_COOKIE_NAME}=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('allows API-key requests without CSRF token', async () => {
    const res = await request(app)
      .post('/state')
      .set('Cookie', ['access_token=token123'])
      .set('x-api-key', 'api-key-token')
      .send({ test: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('allows bearer-token requests without CSRF token', async () => {
    const res = await request(app)
      .post('/state')
      .set('Cookie', ['access_token=token123'])
      .set('authorization', 'Bearer test-token')
      .send({ test: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('exports expected CSRF header name', () => {
    expect(CSRF_HEADER_NAME).toBe('x-csrf-token');
  });

  describe('setup route exemption', () => {
    beforeEach(() => {
      // Mount middleware at /api to mirror real app — req.path is then relative
      app = express();
      app.use(cookieParser());
      app.use(express.json());
      app.use('/api', ensureCsrfCookie);
      app.use('/api', csrfProtection);
      app.post('/api/setup/create-admin', (req, res) => res.json({ success: true }));
      app.post('/api/other', (req, res) => res.json({ success: true }));
    });

    test('allows POST to /api/setup/* with stale access_token cookie and no CSRF header', async () => {
      // Simulates a user who has a leftover access_token from a prior (wiped) install
      const res = await request(app)
        .post('/api/setup/create-admin')
        .set('Cookie', ['access_token=stale-token-from-prior-install'])
        .send({ username: 'admin', password: 'secret' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('still rejects POST to non-setup /api/* with stale access_token and no CSRF header', async () => {
      // Exemption must be scoped to /setup only — other routes remain protected
      const res = await request(app)
        .post('/api/other')
        .set('Cookie', ['access_token=stale-token']);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });
  });

  describe('/auth/refresh exemption', () => {
    beforeEach(() => {
      app = express();
      app.use(cookieParser());
      app.use(express.json());
      app.use('/api', ensureCsrfCookie);
      app.use('/api', csrfProtection);
      app.post('/api/auth/refresh', (req, res) => res.json({ success: true }));
      app.post('/api/auth/login', (req, res) => res.json({ success: true }));
    });

    test('allows POST to /api/auth/refresh with access_token cookie but no CSRF header', async () => {
      // Refresh is protected by the httpOnly SameSite=lax refresh_token cookie —
      // CSRF attacks cannot include that cookie on cross-site POSTs.
      // Requiring CSRF creates a chicken-and-egg problem when the CSRF cookie has
      // expired but the remember-me refresh token is still valid.
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['access_token=expired-but-present']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('still requires CSRF for other /api/auth/* endpoints', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Cookie', ['access_token=token123']);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });
  });
});
