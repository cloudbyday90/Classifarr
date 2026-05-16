/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import request from 'supertest';
import cookieParser from 'cookie-parser';
import { jest } from '@jest/globals';
import {
  createDbRowsResult,
  createDbSingleRowResult,
  createLoggerModuleMock,
  createMockModule,
  createNamedServiceStub,
} from './helpers/mockFactory.mjs';
import { createMountedTestApp } from './helpers/setupRouteTest.mjs';

const db = {
  query: jest.fn(),
};

const { service: authService } = createNamedServiceStub('authService', [
  'authenticate',
  'generateAccessToken',
  'generateRefreshToken',
  'validateRefreshToken',
  'revokeRefreshToken',
  'revokeAllUserTokens',
  'hashToken',
  'auditLog',
  'verifyPassword',
  'hashPassword',
  'validatePasswordStrength',
  'verifyToken',
  'getCookieOptions',
  'getRefreshTokenCookieOptions',
]);

// Setup mock return values for specific methods
authService.getCookieOptions.mockReturnValue({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
authService.getRefreshTokenCookieOptions.mockReturnValue({ httpOnly: true, secure: false, sameSite: 'lax', path: '/api/auth' });

function buildAuthenticateToken() {
  return async (req, res, next) => {
    const header = req.get('Authorization');
    const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const cookieToken = req.cookies?.access_token;
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      req.user = await authService.verifyToken(token);
      return next();
    } catch (error) {
      if (error?.name === 'TokenExpiredError') {
        return res.status(401).json({ error: error.message || 'Token expired' });
      }

      return res.status(403).json({ error: error.message || 'Invalid token' });
    }
  };
}

jest.unstable_mockModule('express-rate-limit', () => ({
  default: jest.fn(() => (req, res, next) => next()),
}));

jest.unstable_mockModule('../config/database.mjs', () => createMockModule(db));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

jest.unstable_mockModule('../services/auth.mjs', () => createMockModule(authService));

jest.unstable_mockModule('../config/runtimeSettings.mjs', () => {
  const getValue = jest.fn(() => false);
  return {
    getValue,
    default: {
      getValue,
    },
  };
});

const issueCsrfToken = jest.fn();
const clearCsrfToken = jest.fn();

jest.unstable_mockModule('../middleware/csrf.mjs', () => ({
  issueCsrfToken,
  clearCsrfToken,
  default: {
    issueCsrfToken,
    clearCsrfToken,
  },
}));

jest.unstable_mockModule('../utils/cookieSecurity.shared.mjs', () => ({
  resolveSecureCookieFlag: jest.fn(() => false),
}));

const _authMockToken = buildAuthenticateToken();

jest.unstable_mockModule('../middleware/auth.mjs', () => ({
  authenticateToken: _authMockToken,
  requireAdmin: (_req, _res, next) => next(),
}));

const { router: authRouter } = await import('../routes/auth.mjs');

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createMountedTestApp({
      basePath: '/auth',
      router: authRouter,
      middleware: [cookieParser()],
    });
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

    it('should pass the lockout error message through to the response verbatim', async () => {
      const lockoutMsg = 'Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.';
      authService.authenticate.mockRejectedValueOnce(new Error(lockoutMsg));

      const res = await request(app)
        .post('/auth/login')
        .send({ identifier: 'lockeduser', password: 'any' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe(lockoutMsg);
    });

    it('should sanitize rememberMe to false when a non-boolean truthy value is sent', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'admin' };
      authService.authenticate.mockResolvedValueOnce(mockUser);
      authService.generateAccessToken.mockResolvedValueOnce('access-token');
      authService.generateRefreshToken.mockResolvedValueOnce('refresh-token');

      await request(app)
        .post('/auth/login')
        .send({ identifier: 'testuser', password: 'pass', rememberMe: 'yes' });

      expect(authService.generateAccessToken.mock.calls[0][1]).toBe(false);
      expect(authService.generateRefreshToken.mock.calls[0][3]).toBe(false);
    });

    it('should return success and set refresh_token cookie on valid login', async () => {
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
      expect(res.body.refreshToken).toBeUndefined();
    });

    it('should pass rememberMe=true to generateRefreshToken when provided', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'admin' };
      authService.authenticate.mockResolvedValueOnce(mockUser);
      authService.generateAccessToken.mockResolvedValueOnce('access-token');
      authService.generateRefreshToken.mockResolvedValueOnce('refresh-token');

      await request(app)
        .post('/auth/login')
        .send({ identifier: 'testuser', password: 'validpass', rememberMe: true });

      expect(authService.generateAccessToken.mock.calls[0][1]).toBe(true);
      expect(authService.generateRefreshToken.mock.calls[0][3]).toBe(true);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 400 when refresh token cookie is missing', async () => {
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
        .set('Cookie', 'refresh_token=invalid-token')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired refresh token');
    });

    it('should return 401 when user not found or inactive', async () => {
      authService.validateRefreshToken.mockResolvedValueOnce({ user_id: 1 });
      db.query.mockResolvedValueOnce(createDbRowsResult());

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=valid-token')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not found or inactive');
    });

    it('should return new access token and set refresh_token cookie on valid refresh', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'admin' };
      authService.validateRefreshToken.mockResolvedValueOnce({ user_id: 1, remember_me: false });
      db.query.mockResolvedValueOnce(createDbSingleRowResult(mockUser));
      authService.revokeRefreshToken.mockResolvedValueOnce(true);
      authService.generateAccessToken.mockResolvedValueOnce('new-access-token');
      authService.generateRefreshToken.mockResolvedValueOnce('new-refresh-token');

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=valid-token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.refreshToken).toBeUndefined();
      expect(authService.generateAccessToken).toHaveBeenCalledWith(mockUser, false);
      expect(authService.generateRefreshToken.mock.invocationCallOrder[0]).toBeLessThan(
        authService.revokeRefreshToken.mock.invocationCallOrder[0],
      );
    });

    it('should revoke all user sessions and return 401 when a replayed (compromised) token is presented', async () => {
      authService.validateRefreshToken.mockResolvedValueOnce({ compromised: true, user_id: 7 });
      authService.revokeAllUserTokens.mockResolvedValueOnce(3);
      authService.auditLog.mockResolvedValueOnce();

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=stolen-token')
        .set('User-Agent', 'test-agent')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/session invalidated/i);
      expect(authService.revokeAllUserTokens).toHaveBeenCalledWith(7);
      expect(authService.auditLog).toHaveBeenCalledWith(
        7,
        'token_replay_detected',
        expect.anything(),
        expect.any(String),
        expect.objectContaining({ warning: expect.stringMatching(/replay/i) }),
      );
    });

    it('should pass slideFromDate (existing expires_at) to generateRefreshToken for remember_me sessions', async () => {
      const existingExpiry = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
      const mockUser = { id: 2, username: 'memuser', role: 'admin' };
      authService.validateRefreshToken.mockResolvedValueOnce({
        user_id: 2,
        remember_me: true,
        expires_at: existingExpiry,
      });
      db.query.mockResolvedValueOnce({ rows: [mockUser] });
      authService.revokeRefreshToken.mockResolvedValueOnce(true);
      authService.generateAccessToken.mockResolvedValueOnce('new-access-token');
      authService.generateRefreshToken.mockResolvedValueOnce('new-refresh-token');

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=remember-me-token')
        .send({});

      expect(res.status).toBe(200);
      expect(authService.generateAccessToken).toHaveBeenCalledWith(mockUser, true);
      const callArgs = authService.generateRefreshToken.mock.calls[0];
      expect(callArgs[3]).toBe(true);
      expect(callArgs[4]).toEqual(existingExpiry);
    });

    it('should return 500 and revoke the new token when old-token revocation fails after generation', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'admin' };
      authService.validateRefreshToken.mockResolvedValueOnce({ user_id: 1, remember_me: false });
      db.query.mockResolvedValueOnce({ rows: [mockUser] });
      authService.generateAccessToken.mockResolvedValueOnce('new-access-token');
      authService.generateRefreshToken.mockResolvedValueOnce('new-refresh-token');
      authService.revokeRefreshToken
        .mockRejectedValueOnce(new Error('rotation write failed'))
        .mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=valid-token')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('rotation write failed');
      expect(authService.revokeRefreshToken).toHaveBeenNthCalledWith(1, 'valid-token', expect.anything());
      expect(authService.revokeRefreshToken).toHaveBeenNthCalledWith(2, 'new-refresh-token', expect.anything());
    });

    it('should return 401 when the old refresh token was already rotated before revocation', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'admin' };
      authService.validateRefreshToken.mockResolvedValueOnce({ user_id: 1, remember_me: false });
      db.query.mockResolvedValueOnce({ rows: [mockUser] });
      authService.generateAccessToken.mockResolvedValueOnce('new-access-token');
      authService.generateRefreshToken.mockResolvedValueOnce('new-refresh-token');
      authService.revokeRefreshToken
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=valid-token')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired refresh token');
      expect(authService.revokeRefreshToken).toHaveBeenNthCalledWith(1, 'valid-token', expect.anything());
      expect(authService.revokeRefreshToken).toHaveBeenNthCalledWith(2, 'new-refresh-token', expect.anything());
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
        .set('Cookie', 'refresh_token=refresh-token')
        .send({});

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
        rows: [{ id: 1, username: 'testuser', role: 'admin', is_active: true, last_login: '2026-01-01', created_at: '2025-01-01' }],
      });

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });

    it('should prefer Authorization bearer token over stale access_token cookie', async () => {
      authService.verifyToken.mockImplementationOnce(async (token) => {
        if (token === 'valid-token') {
          return { id: 1, username: 'testuser', role: 'admin' };
        }
        throw Object.assign(new Error('jwt malformed'), { name: 'JsonWebTokenError' });
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, username: 'testuser', role: 'admin', is_active: true, last_login: '2026-01-01', created_at: '2025-01-01' }],
      });

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token')
        .set('Cookie', 'access_token=stale-cookie-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(authService.verifyToken).toHaveBeenCalledWith('valid-token');
    });

    it('should return 404 when user not found', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 999, username: 'ghost', role: 'admin' });
      db.query.mockResolvedValueOnce(createDbRowsResult());

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
      authService.hashToken.mockResolvedValueOnce('current-token-hash');
      authService.revokeAllUserTokens.mockResolvedValueOnce(2);
      authService.auditLog.mockResolvedValueOnce();

      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .set('Cookie', 'refresh_token=current-refresh-token')
        .set('User-Agent', 'test-agent')
        .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!', confirmPassword: 'NewPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(authService.hashToken).toHaveBeenCalledWith('current-refresh-token');
      expect(authService.revokeAllUserTokens).toHaveBeenCalledWith(1, 'current-token-hash');
      expect(authService.auditLog).toHaveBeenCalledWith(
        1,
        'password_changed',
        expect.anything(),
        expect.any(String),
        { otherSessionsRevoked: 2 },
      );
    });

    it('should revoke all sessions when no refresh token cookie is present during password change', async () => {
      authService.verifyToken.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'admin' });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: true });
      db.query.mockResolvedValueOnce({ rows: [{ password_hash: 'oldhash' }] });
      authService.verifyPassword.mockResolvedValueOnce(true);
      authService.hashPassword.mockResolvedValueOnce('newhash');
      db.query.mockResolvedValueOnce({});
      authService.revokeAllUserTokens.mockResolvedValueOnce(3);
      authService.auditLog.mockResolvedValueOnce();

      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!', confirmPassword: 'NewPass123!' });

      expect(res.status).toBe(200);
      expect(authService.hashToken).not.toHaveBeenCalled();
      expect(authService.revokeAllUserTokens).toHaveBeenCalledWith(1, null);
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
        rows: [{ last_login: '2026-01-01', created_at: '2025-01-01' }],
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
        rows: [{ id: 1, user_agent: 'Chrome', device_info: null, created_at: '2026-01-01', expires_at: '2026-01-08' }],
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
      db.query.mockResolvedValueOnce(createDbRowsResult());

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
