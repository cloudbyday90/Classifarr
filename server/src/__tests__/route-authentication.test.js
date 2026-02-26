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

jest.mock('../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../services/auth', () => ({
  verifyToken: jest.fn(),
  validatePasswordStrength: jest.fn(),
  hashPassword: jest.fn(),
  verifyPassword: jest.fn()
}));

const db = require('../config/database');
const authService = require('../services/auth');
const apiRouter = require('../routes/api');
const { ensureCsrfCookie, csrfProtection, CSRF_COOKIE_NAME } = require('../middleware/csrf');

describe('Route Authentication', () => {
  let app;
  let csrfApp;
  let adminToken;
  let userToken;

  beforeAll(() => {
    adminToken = 'valid-admin-token';
    userToken = 'valid-user-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
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
        });
      });
    });
  });

  describe('Token validation', () => {
    it('should reject expired tokens', async () => {
      authService.verifyToken.mockRejectedValueOnce(new Error('Token expired'));
      
      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', 'Bearer expired_token');
      
      expect(res.status).toBe(403);
    });

    it('should reject malformed tokens', async () => {
      authService.verifyToken.mockRejectedValueOnce(new Error('Malformed token'));
      
      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', 'Bearer malformed');
      
      expect(res.status).toBe(403);
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
