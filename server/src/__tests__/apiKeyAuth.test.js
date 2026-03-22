/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// Set environment variable to prevent warnings during test initialization
process.env.API_KEY_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const { authenticateApiKey, authenticateTokenOrApiKey, requireReadWrite } = require('../middleware/apiKeyAuth');
const apiKeyService = require('../services/apiKeyService');
const authService = require('../services/auth');
const { createConsoleSpy } = require('./setup/consoleHelpers');

// Mock the services
jest.mock('../services/apiKeyService');
jest.mock('../services/auth');

describe('API Key Authentication Middleware', () => {
  let req, res, next;
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = createConsoleSpy('error', { suppress: true });
  });

  afterAll(() => {
    consoleErrorSpy.restore();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock request, response, and next
    req = {
      headers: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      originalUrl: '/',
      url: '/'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  describe('authenticateApiKey', () => {
    test('should authenticate with valid API key', async () => {
      const mockValidKey = {
        id: 1,
        name: 'Test Key',
        permissions: 'read_write',
        is_active: true
      };

      req.headers['x-api-key'] = 'clf_validkey123456789012345678901';
      apiKeyService.validateApiKey.mockResolvedValue(mockValidKey);
      apiKeyService.updateLastUsed.mockResolvedValue(true);
      apiKeyService.logAudit.mockResolvedValue(true);

      await authenticateApiKey(req, res, next);

      expect(apiKeyService.validateApiKey).toHaveBeenCalledWith('clf_validkey123456789012345678901');
      expect(req.apiKey).toEqual(mockValidKey);
      expect(apiKeyService.updateLastUsed).toHaveBeenCalledWith(1, '127.0.0.1');
      expect(apiKeyService.logAudit).toHaveBeenCalledWith(1, 'used', expect.objectContaining({
        endpoint: '/',
        ipAddress: '127.0.0.1',
        userAgent: undefined
      }));
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject request without API key', async () => {
      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'API key required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject invalid API key', async () => {
      req.headers['x-api-key'] = 'clf_invalidkey123456789012345678901';
      apiKeyService.validateApiKey.mockResolvedValue(null);

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired API key' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject expired API key', async () => {
      req.headers['x-api-key'] = 'clf_expiredkey123456789012345678901';
      apiKeyService.validateApiKey.mockResolvedValue(null); // validateApiKey returns null for expired keys

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired API key' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle validation errors gracefully', async () => {
      req.headers['x-api-key'] = 'clf_errorkey1234567890123456789012';
      apiKeyService.validateApiKey.mockRejectedValue(new Error('Database error'));

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication error' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should continue even if updateLastUsed fails', async () => {
      const mockValidKey = {
        id: 1,
        name: 'Test Key',
        permissions: 'read_write',
        is_active: true
      };

      req.headers['x-api-key'] = 'clf_validkey123456789012345678901';
      apiKeyService.validateApiKey.mockResolvedValue(mockValidKey);
      apiKeyService.updateLastUsed.mockRejectedValue(new Error('Update failed'));
      apiKeyService.logAudit.mockResolvedValue(true);

      await authenticateApiKey(req, res, next);

      // Should still call next even if updateLastUsed fails (it's non-blocking)
      expect(next).toHaveBeenCalled();
      expect(req.apiKey).toEqual(mockValidKey);
    });

    test('should use connection.remoteAddress if req.ip is not available', async () => {
      const mockValidKey = {
        id: 1,
        name: 'Test Key',
        permissions: 'read_write',
        is_active: true
      };

      req.ip = undefined;
      req.connection.remoteAddress = '192.168.1.1';
      req.headers['x-api-key'] = 'clf_validkey123456789012345678901';
      apiKeyService.validateApiKey.mockResolvedValue(mockValidKey);
      apiKeyService.updateLastUsed.mockResolvedValue(true);
      apiKeyService.logAudit.mockResolvedValue(true);

      await authenticateApiKey(req, res, next);

      expect(apiKeyService.updateLastUsed).toHaveBeenCalledWith(1, '192.168.1.1');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('authenticateTokenOrApiKey', () => {
    test('should use API key authentication when X-API-Key header is present', async () => {
      const mockValidKey = {
        id: 1,
        name: 'Test Key',
        permissions: 'read_write',
        is_active: true
      };

      req.headers['x-api-key'] = 'clf_validkey123456789012345678901';
      apiKeyService.validateApiKey.mockResolvedValue(mockValidKey);
      apiKeyService.updateLastUsed.mockResolvedValue(true);
      apiKeyService.logAudit.mockResolvedValue(true);

      await authenticateTokenOrApiKey(req, res, next);

      expect(apiKeyService.validateApiKey).toHaveBeenCalled();
      expect(authService.verifyToken).not.toHaveBeenCalled();
      expect(req.apiKey).toEqual(mockValidKey);
      expect(next).toHaveBeenCalled();
    });

    test('should use JWT authentication when no API key is present', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        role: 'admin'
      };

      req.headers['authorization'] = 'Bearer validtoken123';
      authService.verifyToken.mockResolvedValue(mockUser);

      await authenticateTokenOrApiKey(req, res, next);

      expect(apiKeyService.validateApiKey).not.toHaveBeenCalled();
      expect(authService.verifyToken).toHaveBeenCalledWith('validtoken123');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    test('should prefer Authorization bearer token over stale access_token cookie', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        role: 'admin'
      };

      req.cookies = { access_token: 'stale-cookie-token' };
      req.headers['authorization'] = 'Bearer validtoken123';
      authService.verifyToken.mockResolvedValue(mockUser);

      await authenticateTokenOrApiKey(req, res, next);

      expect(authService.verifyToken).toHaveBeenCalledWith('validtoken123');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    test('should reject when neither API key nor JWT token is present', async () => {
      await authenticateTokenOrApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject invalid JWT token with 403', async () => {
      req.headers['authorization'] = 'Bearer invalidtoken';
      const err = new Error('jwt malformed');
      err.name = 'JsonWebTokenError';
      authService.verifyToken.mockRejectedValue(err);

      await authenticateTokenOrApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for expired JWT token so the client interceptor can refresh', async () => {
      req.headers['authorization'] = 'Bearer expiredtoken';
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      authService.verifyToken.mockRejectedValue(err);

      await authenticateTokenOrApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle malformed Authorization header', async () => {
      req.headers['authorization'] = 'InvalidFormat';

      await authenticateTokenOrApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should prefer API key over JWT when both are present', async () => {
      const mockValidKey = {
        id: 1,
        name: 'Test Key',
        permissions: 'read_write',
        is_active: true
      };

      req.headers['x-api-key'] = 'clf_validkey123456789012345678901';
      req.headers['authorization'] = 'Bearer validtoken123';
      apiKeyService.validateApiKey.mockResolvedValue(mockValidKey);
      apiKeyService.updateLastUsed.mockResolvedValue(true);

      await authenticateTokenOrApiKey(req, res, next);

      // Should use API key, not JWT
      expect(apiKeyService.validateApiKey).toHaveBeenCalled();
      expect(authService.verifyToken).not.toHaveBeenCalled();
      expect(req.apiKey).toEqual(mockValidKey);
    });
  });

  describe('requireReadWrite', () => {
    test('should allow request with read_write API key', () => {
      req.apiKey = {
        id: 1,
        permissions: 'read_write'
      };

      requireReadWrite(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block request with read_only API key', () => {
      req.apiKey = {
        id: 1,
        permissions: 'read_only'
      };

      requireReadWrite(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'This endpoint requires read-write permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow request authenticated with JWT (no apiKey)', () => {
      req.user = {
        id: 1,
        username: 'testuser'
      };

      requireReadWrite(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow request with no authentication info (for chaining)', () => {
      // This case would normally be blocked by authenticateTokenOrApiKey first
      requireReadWrite(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Middleware Integration', () => {
    test('should work in chain: authenticateTokenOrApiKey -> requireReadWrite', async () => {
      const mockValidKey = {
        id: 1,
        name: 'Test Key',
        permissions: 'read_write',
        is_active: true
      };

      req.headers['x-api-key'] = 'clf_validkey123456789012345678901';
      apiKeyService.validateApiKey.mockResolvedValue(mockValidKey);
      apiKeyService.updateLastUsed.mockResolvedValue(true);

      // First middleware
      await authenticateTokenOrApiKey(req, res, next);
      expect(next).toHaveBeenCalled();

      // Reset next mock for second middleware
      next.mockClear();

      // Second middleware
      requireReadWrite(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block in chain when using read_only key', async () => {
      const mockReadOnlyKey = {
        id: 1,
        name: 'Read Only Key',
        permissions: 'read_only',
        is_active: true
      };

      req.headers['x-api-key'] = 'clf_readonlykey123456789012345678';
      apiKeyService.validateApiKey.mockResolvedValue(mockReadOnlyKey);
      apiKeyService.updateLastUsed.mockResolvedValue(true);

      // First middleware
      await authenticateTokenOrApiKey(req, res, next);
      expect(next).toHaveBeenCalled();

      // Reset next and res mocks for second middleware
      next.mockClear();
      res.status.mockClear();
      res.json.mockClear();

      // Second middleware should block
      requireReadWrite(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
