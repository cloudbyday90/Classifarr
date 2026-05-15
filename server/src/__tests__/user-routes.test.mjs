/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createNamedMockModule, createLoggerModuleMock } from './helpers/mockFactory.mjs';

const db = {
  query: jest.fn(),
};

const authService = {
  validatePasswordStrength: jest.fn(),
  verifyPassword: jest.fn(),
  hashPassword: jest.fn(),
  auditLog: jest.fn(),
  verifyToken: jest.fn(),
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

jest.unstable_mockModule('../services/auth.mjs', () => ({
  ...authService,
}));

const _mockAuthenticateToken = async (req, res, next) => {
  const authorization = req.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    req.user = await authService.verifyToken(authorization.slice(7));
    return next();
  } catch (_error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

jest.unstable_mockModule('../middleware/auth.mjs', () => ({
  authenticateToken: _mockAuthenticateToken,
  requireAdmin: (_req, _res, next) => next(),
}));

const { router: userRouter } = await import('../routes/user.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

describe('User Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/user', userRouter);
    app.use(errorHandler);
  });

  describe('GET /user/me', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/user/me');

      expect(res.status).toBe(401);
    });

    it('should return user info with valid token', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, username: 'testuser', role: 'admin', is_active: true, last_login: '2026-01-01', created_at: '2025-01-01' }],
      });

      const res = await request(app)
        .get('/user/me')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.username).toBe('testuser');
    });

    it('should return 404 when user not found', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 999, username: 'ghost', role: 'admin' });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/user/me')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('should return 500 on database error', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .get('/user/me')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
      expect(res.body.message).toBe('DB error');
    });
  });

  describe('PATCH /user/profile', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .patch('/user/profile')
        .send({ username: 'newname' });

      expect(res.status).toBe(401);
    });

    it('should return 400 when username is too short', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });

      const res = await request(app)
        .patch('/user/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ username: 'ab' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username must be between 3 and 50 characters');
    });

    it('should return 400 when username is too long', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });

      const res = await request(app)
        .patch('/user/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ username: 'a'.repeat(51) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username must be between 3 and 50 characters');
    });

    it('should return 400 when username is taken', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

      const res = await request(app)
        .patch('/user/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ username: 'existinguser' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username already taken');
    });

    it('should update username successfully', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({});
      authService.auditLog.mockResolvedValueOnce();

      const res = await request(app)
        .patch('/user/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ username: 'newusername' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.username).toBe('newusername');
    });

    it('should return 500 on database error', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .patch('/user/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ username: 'newusername' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
      expect(res.body.message).toBe('DB error');
    });
  });

  describe('PATCH /user/password', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .patch('/user/password')
        .send({ currentPassword: 'old', newPassword: 'New123!', confirmPassword: 'New123!' });

      expect(res.status).toBe(401);
    });

    it('should return 400 when fields are missing', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });

      const res = await request(app)
        .patch('/user/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'old', newPassword: 'new' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('All password fields are required');
    });

    it('should return 400 when passwords do not match', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });

      const res = await request(app)
        .patch('/user/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'old', newPassword: 'New123!', confirmPassword: 'Different!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Passwords do not match');
    });

    it('should return 400 when password is weak', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: false, message: 'Password too weak' });

      const res = await request(app)
        .patch('/user/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'old', newPassword: 'weak', confirmPassword: 'weak' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password too weak');
    });

    it('should return 404 when user not found', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: true });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch('/user/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'old', newPassword: 'NewPass123!', confirmPassword: 'NewPass123!' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('should return 401 when current password is wrong', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: true });
      db.query.mockResolvedValueOnce({ rows: [{ password_hash: 'hash' }] });
      authService.verifyPassword.mockResolvedValueOnce(false);

      const res = await request(app)
        .patch('/user/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'wrong', newPassword: 'NewPass123!', confirmPassword: 'NewPass123!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Current password is incorrect');
    });

    it('should change password successfully', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: true });
      db.query.mockResolvedValueOnce({ rows: [{ password_hash: 'oldhash' }] });
      authService.verifyPassword.mockResolvedValueOnce(true);
      authService.hashPassword.mockResolvedValueOnce('newhash');
      db.query.mockResolvedValueOnce({});
      authService.auditLog.mockResolvedValueOnce();

      const res = await request(app)
        .patch('/user/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!', confirmPassword: 'NewPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password updated successfully');
    });

    it('should return 500 on database error', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: true });
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .patch('/user/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'old', newPassword: 'NewPass123!', confirmPassword: 'NewPass123!' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
      expect(res.body.message).toBe('DB error');
    });
  });
});
