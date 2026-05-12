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

import { jest } from '@jest/globals';
import { createHttpResponseMock, createMockModule } from './helpers/mockFactory.mjs';
import { createConsoleSpy } from './setup/consoleHelpers.mjs';

const apiKeyService = {
  validateApiKey: jest.fn(),
  updateLastUsed: jest.fn(),
  logAudit: jest.fn(),
};

jest.unstable_mockModule('../services/apiKeyService.mjs', () => createMockModule(apiKeyService));

const authService = {
  verifyToken: jest.fn(),
};

jest.unstable_mockModule('../services/auth.mjs', () => createMockModule(authService));

const {
  authenticateApiKey,
  authenticateTokenOrApiKey,
  requireReadWrite,
  requireAdmin,
  requireWebhookOrAdmin,
} = await import('../middleware/apiKeyAuth.mjs');

describe('API Key auth middleware - additional permission and fallback branches', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      headers: {},
      cookies: undefined,
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      originalUrl: '/api/health',
      url: '/api/health',
      user: undefined,
      apiKey: undefined,
    };

    res = createHttpResponseMock();

    next = jest.fn();
  });

  test('authenticateTokenOrApiKey uses cookie access token when present', async () => {
    req.cookies = { access_token: 'cookie-access-token' };
    authService.verifyToken.mockResolvedValueOnce({ id: 1, role: 'admin' });

    await authenticateTokenOrApiKey(req, res, next);

    expect(authService.verifyToken).toHaveBeenCalledWith('cookie-access-token');
    expect(req.user).toEqual({ id: 1, role: 'admin' });
    expect(next).toHaveBeenCalled();
  });

  test('requireReadWrite blocks webhook_only API keys from non-webhook write endpoints', () => {
    req.apiKey = { id: 9, permissions: 'webhook_only' };

    requireReadWrite(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This endpoint requires read-write permissions. Webhook-only keys cannot access this endpoint.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAdmin allows admin API keys and blocks non-admin API keys', () => {
    req.apiKey = { id: 1, permissions: 'admin' };
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    next.mockClear();
    req.apiKey = { id: 2, permissions: 'read_write' };
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'This endpoint requires admin permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAdmin enforces admin role for JWT-authenticated users', () => {
    req.user = { id: 2, role: 'user' };
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });

    res.status.mockClear();
    res.json.mockClear();
    next.mockClear();

    req.user = { id: 1, role: 'admin' };
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('requireAdmin rejects requests with no authenticated principal', () => {
    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('requireWebhookOrAdmin blocks webhook_only key on non-webhook route', () => {
    req.apiKey = { id: 1, permissions: 'webhook_only' };
    req.originalUrl = '/api/settings';

    requireWebhookOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Webhook-only keys can only access webhook endpoints',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('requireWebhookOrAdmin allows webhook_only key on webhook routes', () => {
    req.apiKey = { id: 1, permissions: 'webhook_only' };
    req.originalUrl = '/api/webhook/request';

    requireWebhookOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('requireWebhookOrAdmin uses req.url when originalUrl is absent', () => {
    req.apiKey = { id: 1, permissions: 'webhook_only' };
    req.originalUrl = undefined;
    req.url = '/api/webhook/test';

    requireWebhookOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('requireWebhookOrAdmin rejects requests with no authenticated principal', () => {
    requireWebhookOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('authenticateApiKey continues when audit/update side effects fail asynchronously', async () => {
    const errorSpy = createConsoleSpy('error', { suppress: true });

    req.headers['x-api-key'] = 'clf_testapikey00000000000000000000';
    req.originalUrl = '/api/test';
    apiKeyService.validateApiKey.mockResolvedValueOnce({ id: 77, permissions: 'read_write' });
    apiKeyService.updateLastUsed.mockRejectedValueOnce(new Error('update fail'));
    apiKeyService.logAudit.mockRejectedValueOnce(new Error('audit fail'));

    await authenticateApiKey(req, res, next);
    await Promise.resolve();
    await Promise.resolve();

    expect(next).toHaveBeenCalled();
    expect(errorSpy.spy).toHaveBeenCalled();
    errorSpy.restore();
  });

  test('authenticateApiKey blocks embed_service keys from Classifarr API routes', async () => {
    req.headers['x-api-key'] = 'clf_embedkey0000000000000000000000';
    apiKeyService.validateApiKey.mockResolvedValueOnce({ id: 81, permissions: 'embed_service' });

    await authenticateApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Embedding-service keys are reserved for sidecar authentication and cannot access Classifarr API endpoints.',
    });
    expect(next).not.toHaveBeenCalled();
    expect(apiKeyService.updateLastUsed).not.toHaveBeenCalled();
    expect(apiKeyService.logAudit).not.toHaveBeenCalled();
  });

  test('requireReadWrite blocks embed_service API keys', () => {
    req.apiKey = { id: 11, permissions: 'embed_service' };

    requireReadWrite(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This endpoint requires a standard Classifarr API key. Embedding-service keys are reserved for sidecar authentication.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('requireReadWrite rejects requests with no authenticated principal', () => {
    requireReadWrite(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });
});
