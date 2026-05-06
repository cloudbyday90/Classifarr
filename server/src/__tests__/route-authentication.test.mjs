/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { jest } from '@jest/globals';

const authService = {
  verifyToken: jest.fn(),
  validatePasswordStrength: jest.fn(),
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
};

const runtimeSettings = {
  getValue: jest.fn(),
};

jest.unstable_mockModule('../services/auth.mjs', () => ({ ...authService }));
jest.unstable_mockModule('../config/runtimeSettings.mjs', () => ({ default: runtimeSettings }));
jest.unstable_mockModule('../utils/cookieSecurity.shared.mjs', () => ({
  resolveSecureCookieFlag: jest.fn(() => false),
  default: {
    resolveSecureCookieFlag: jest.fn(() => false),
  },
}));

function createStubRouter(routeDefinitions) {
  const router = express.Router();

  routeDefinitions.forEach(({ method, path = '/', status = 200, body = { ok: true } }) => {
    router[method](path, (_req, res) => {
      res.status(status).json(body);
    });
  });

  return router;
}

const routeModuleDefinitions = [
  ['../routes/webhook.mjs', [{ method: 'get' }]],
  ['../routes/mediaServer.mjs', [{ method: 'get' }]],
  ['../routes/libraries.mjs', [{ method: 'get' }]],
  ['../routes/classification.mjs', [{ method: 'get', path: '/history' }, { method: 'post', path: '/retry', body: { success: true } }]],
  ['../routes/settings.mjs', [{ method: 'get' }]],
  ['../routes/logs.mjs', [{ method: 'get' }]],
  ['../routes/mediaSync.mjs', [{ method: 'get' }]],
  ['../routes/clarification.mjs', [{ method: 'get' }]],
  ['../routes/plexOAuth.mjs', [{ method: 'get' }]],
  ['../routes/jellyfinAuth.mjs', [{ method: 'get' }]],
  ['../routes/embyAuth.mjs', [{ method: 'get' }]],
  ['../routes/queue.mjs', [{ method: 'get' }]],
  ['../routes/requests.mjs', [{ method: 'get' }]],
  ['../routes/stats.mjs', [{ method: 'get' }]],
  ['../routes/scheduler.mjs', [{ method: 'get', path: '/status' }]],
  ['../routes/backup.mjs', [{ method: 'get', path: '/list' }]],
  ['../routes/mappings.mjs', [{ method: 'get' }]],
  ['../routes/reclassification.mjs', [{ method: 'get' }]],
  ['../routes/pathMappings.mjs', [{ method: 'get' }]],
  ['../routes/confidence.mjs', [{ method: 'get' }]],
  ['../routes/rag.mjs', [{ method: 'get', path: '/status' }]],
  ['../routes/patterns.mjs', [{ method: 'get' }]],
  ['../routes/evidence.mjs', [{ method: 'get' }]],
  ['../routes/feedback.mjs', [{ method: 'get' }]],
  ['../routes/prompts.mjs', [{ method: 'get' }]],
  ['../routes/policies.mjs', [{ method: 'get' }]],
  ['../routes/presets.mjs', [{ method: 'get' }]],
  ['../routes/suggestions.mjs', [{ method: 'get' }]],
  ['../routes/migration.mjs', [{ method: 'get', path: '/status' }]],
  ['../routes/ratingNormalization.mjs', [{ method: 'get' }]],
  ['../routes/sync.mjs', [{ method: 'get', path: '/status' }]],
  ['../routes/apiKeys.mjs', [{ method: 'get' }]],
  ['../routes/notifications.mjs', [{ method: 'get' }]],
  ['../routes/classificationProgress.mjs', [{ method: 'get' }]],
];

for (const [modulePath, routeDefinitions] of routeModuleDefinitions) {
  jest.unstable_mockModule(modulePath, () => ({
    default: createStubRouter(routeDefinitions),
  }));
}

const { ensureCsrfCookie, csrfProtection, CSRF_COOKIE_NAME } = await import('../middleware/csrf.mjs');
const { default: apiRouter } = await import('../routes/api.mjs');

describe('Route Authentication', () => {
  let app;
  let csrfApp;

  const adminToken = 'valid-admin-token';
  const userToken = 'valid-user-token';

  beforeEach(() => {
    jest.clearAllMocks();

    runtimeSettings.getValue.mockImplementation((key) => key === 'csrf_protection');

    app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    csrfApp = express();
    csrfApp.use(express.json());
    csrfApp.use(cookieParser());
    csrfApp.use(ensureCsrfCookie);
    csrfApp.use('/api', csrfProtection);
    csrfApp.use('/api', apiRouter);

    authService.verifyToken.mockImplementation(async (token) => {
      if (token === adminToken) {
        return { id: 1, username: 'admin', role: 'admin' };
      }

      if (token === userToken) {
        return { id: 2, username: 'user', role: 'user' };
      }

      throw new Error('Invalid token');
    });
  });

  describe('Tier 1: Admin-Only Routes (authenticateToken + requireAdmin)', () => {
    const adminRoutes = [
      { method: 'get', path: '/api/media-server' },
      { method: 'get', path: '/api/classification/history' },
      { method: 'post', path: '/api/classification/retry' },
      { method: 'get', path: '/api/settings' },
      { method: 'get', path: '/api/reclassification' },
      { method: 'get', path: '/api/policies' },
      { method: 'get', path: '/api/mappings' },
      { method: 'get', path: '/api/confidence' },
      { method: 'get', path: '/api/rag/status' },
      { method: 'get', path: '/api/patterns' },
      { method: 'get', path: '/api/scheduler/status' },
      { method: 'get', path: '/api/backup/list' },
      { method: 'get', path: '/api/settings/path-mappings' },
      { method: 'get', path: '/api/keys' },
    ];

    adminRoutes.forEach(({ method, path }) => {
      describe(`${method.toUpperCase()} ${path}`, () => {
        it('should return 401 without authentication', async () => {
          const res = await request(app)[method](path);
          expect(res.status).toBe(401);
        });

        it('should return 403 with invalid token', async () => {
          const res = await request(app)
            [method](path)
            .set('Authorization', 'Bearer invalid_token');

          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Invalid or expired token');
        });

        it('should return 403 for non-admin user', async () => {
          const res = await request(app)
            [method](path)
            .set('Authorization', `Bearer ${userToken}`);

          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Admin access required');
        });
      });
    });
  });

  describe('Tier 2: Authenticated User Routes (authenticateToken only)', () => {
    const userRoutes = [
      { method: 'get', path: '/api/clarifications' },
      { method: 'get', path: '/api/requests' },
      { method: 'get', path: '/api/feedback' },
      { method: 'get', path: '/api/prompts' },
      { method: 'get', path: '/api/presets' },
      { method: 'get', path: '/api/suggestions' },
      { method: 'get', path: '/api/migration/status' },
      { method: 'get', path: '/api/rating-normalization' },
      { method: 'get', path: '/api/sync/status' },
      { method: 'get', path: '/api/notifications' },
    ];

    userRoutes.forEach(({ method, path }) => {
      describe(`${method.toUpperCase()} ${path}`, () => {
        it('should return 401 without authentication', async () => {
          const res = await request(app)[method](path);
          expect(res.status).toBe(401);
        });

        it('should return 403 with invalid token', async () => {
          const res = await request(app)
            [method](path)
            .set('Authorization', 'Bearer invalid_token');

          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Invalid or expired token');
        });
      });
    });
  });

  describe('Token validation', () => {
    it('should reject expired tokens with 401', async () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      authService.verifyToken.mockRejectedValueOnce(error);

      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', 'Bearer expired_token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token expired');
    });

    it('should reject malformed tokens', async () => {
      authService.verifyToken.mockRejectedValueOnce(new Error('Malformed token'));

      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', 'Bearer malformed');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Invalid or expired token');
    });
  });

  describe('CSRF protection on classification retry mutation', () => {
    it('should return 403 when cookie-authenticated request is missing CSRF header', async () => {
      const res = await request(csrfApp)
        .post('/api/classification/retry')
        .set('Cookie', [`access_token=${adminToken}`])
        .send({ classificationIds: [123] });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });

    it('should return 403 when CSRF header does not match cookie token', async () => {
      const res = await request(csrfApp)
        .post('/api/classification/retry')
        .set('Cookie', [`access_token=${adminToken}`, `${CSRF_COOKIE_NAME}=csrf-cookie-token`])
        .set('X-CSRF-Token', 'csrf-header-token-mismatch')
        .send({ classificationIds: [123] });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });
  });

  describe('Public routes (no auth required)', () => {
    it('GET /api should be accessible without auth', async () => {
      const res = await request(app).get('/api');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Classifarr API');
    });
  });
});
