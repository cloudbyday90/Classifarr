/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');

jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});

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
  authenticate: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  revokeAllUserTokens: jest.fn(),
  auditLog: jest.fn(),
  verifyPassword: jest.fn(),
  hashPassword: jest.fn(),
  validatePasswordStrength: jest.fn(),
  verifyToken: jest.fn(),
  getCookieOptions: jest.fn(() => ({ httpOnly: true, secure: false, sameSite: 'strict', path: '/' }))
}));

const db = require('../config/database');
const authService = require('../services/auth');
const authRouter = require('../routes/auth');

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
  });

  describe('POST /auth/login', () => {
    it('should return 400 when username is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'test123' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ identifier: 'testuser' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username and password are required');
    });

    it('should return 401 when authentication fails', async () => {
      authService.authenticate.mockRejectedValueOnce(new Error('Invalid credentials'));
      
      const res = await request(app)
        .post('/auth/login')
        .send({ identifier: 'testuser', password: 'wrongpass' });
      
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return success with tokens on valid login', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'admin' };
      authService.authenticate.mockResolvedValueOnce(mockUser);
      authService.generateAccessToken.mockResolvedValueOnce('access-token');
      authService.generateRefreshToken.mockResolvedValueOnce('refresh-token');
      
      const res = await request(app)
        .post('/auth/login')
        .send({ identifier: 'testuser', password: 'validpass' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe(1);
      expect(res.body.refreshToken).toBe('refresh-token');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 400 when refresh token is missing', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Refresh token is required');
    });

    it('should return 401 when refresh token is invalid', async () => {
      authService.validateRefreshToken.mockResolvedValueOnce(null);
      
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' });
      
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired refresh token');
    });

    it('should return 401 when user not found or inactive', async () => {
      authService.validateRefreshToken.mockResolvedValueOnce({ user_id: 1 });
      db.query.mockResolvedValueOnce({ rows: [] });
      
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-token' });
      
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not found or inactive');
    });

    it('should return new tokens on valid refresh', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'admin' };
      authService.validateRefreshToken.mockResolvedValueOnce({ user_id: 1 });
      db.query.mockResolvedValueOnce({ rows: [mockUser] });
      authService.revokeRefreshToken.mockResolvedValueOnce();
      authService.generateAccessToken.mockResolvedValueOnce('new-access-token');
      authService.generateRefreshToken.mockResolvedValueOnce('new-refresh-token');
      
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-token' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.refreshToken).toBe('new-refresh-token');
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .send({});
      
      expect(res.status).toBe(401);
    });

    it('should logout successfully with valid token', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.revokeRefreshToken.mockResolvedValueOnce();
      authService.auditLog.mockResolvedValueOnce();
      
      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .send({ refreshToken: 'refresh-token' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/auth/logout-all')
        .send({});
      
      expect(res.status).toBe(401);
    });

    it('should revoke all tokens successfully', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.revokeAllUserTokens.mockResolvedValueOnce(5);
      authService.auditLog.mockResolvedValueOnce();
      
      const res = await request(app)
        .post('/auth/logout-all')
        .set('Authorization', 'Bearer valid-token')
        .send({});
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tokensRevoked).toBe(5);
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/auth/me');
      
      expect(res.status).toBe(401);
    });

    it('should return user info with valid token', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, username: 'testuser', role: 'admin', is_active: true, last_login: '2026-01-01', created_at: '2025-01-01' }]
      });
      
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token');
      
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });

    it('should return 404 when user not found', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 999, username: 'ghost', role: 'admin' });
      db.query.mockResolvedValueOnce({ rows: [] });
      
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token');
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });
  });

  describe('POST /auth/change-password', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/auth/change-password')
        .send({});
      
      expect(res.status).toBe(401);
    });

    it('should return 400 when fields are missing', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      
      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'old', newPassword: 'new' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('All password fields are required');
    });

    it('should return 400 when passwords do not match', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      
      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'old', newPassword: 'new', confirmPassword: 'different' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('New passwords do not match');
    });

    it('should return 400 when password is weak', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: false, message: 'Password too weak' });
      
      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'old', newPassword: 'new', confirmPassword: 'new' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password too weak');
    });

    it('should return 401 when current password is wrong', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: true });
      db.query.mockResolvedValueOnce({ rows: [{ password_hash: 'hash' }] });
      authService.verifyPassword.mockResolvedValueOnce(false);
      
      const res = await request(app)
        .post('/auth/change-password')
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
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!', confirmPassword: 'NewPass123!' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /auth/session', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/auth/session');
      
      expect(res.status).toBe(401);
    });

    it('should return session info', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockResolvedValueOnce({
        rows: [{ last_login: '2026-01-01', created_at: '2025-01-01' }]
      });
      
      const res = await request(app)
        .get('/auth/session')
        .set('Authorization', 'Bearer valid-token');
      
      expect(res.status).toBe(200);
      expect(res.body.started).toBe('2026-01-01');
    });
  });

  describe('GET /auth/sessions', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/auth/sessions');
      
      expect(res.status).toBe(401);
    });

    it('should return active sessions', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_agent: 'Chrome', device_info: null, created_at: '2026-01-01', expires_at: '2026-01-08' }]
      });
      
      const res = await request(app)
        .get('/auth/sessions')
        .set('Authorization', 'Bearer valid-token');
      
      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
    });
  });

  describe('DELETE /auth/sessions/:id', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .delete('/auth/sessions/1');
      
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid session ID', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      
      const res = await request(app)
        .delete('/auth/sessions/invalid')
        .set('Authorization', 'Bearer valid-token');
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid session ID');
    });

    it('should return 404 when session not found', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockResolvedValueOnce({ rows: [] });
      
      const res = await request(app)
        .delete('/auth/sessions/999')
        .set('Authorization', 'Bearer valid-token');
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found or already revoked');
    });

    it('should revoke session successfully', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      db.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
      
      const res = await request(app)
        .delete('/auth/sessions/5')
        .set('Authorization', 'Bearer valid-token');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
