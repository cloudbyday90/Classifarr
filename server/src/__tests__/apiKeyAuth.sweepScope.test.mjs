/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createLoggerModuleMock, createMockModule } from './helpers/mockFactory.mjs';
import {
  LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES,
  LOCAL_AI_POLICY_SWEEP_TOKEN_AUDIENCE,
  LOCAL_AI_POLICY_SWEEP_TOKEN_USE,
} from '../services/localAiPolicySweepAccess.mjs';

const authService = { verifyToken: jest.fn() };
const apiKeyService = {
  validateApiKey: jest.fn(), updateLastUsed: jest.fn(), logAudit: jest.fn(),
};
const loggerModule = createLoggerModuleMock();
jest.unstable_mockModule('../services/auth.mjs', () => createMockModule(authService));
jest.unstable_mockModule('../services/apiKeyService.mjs', () => createMockModule(apiKeyService));
jest.unstable_mockModule('../utils/logger.mjs', () => loggerModule.module);

const { authenticateToken } = await import('../middleware/auth.mjs');
const { authenticateTokenOrApiKey, requireReadWrite } = await import('../middleware/apiKeyAuth.mjs');
const { createQueueRouter } = await import('../routes/queueRouteShared.mjs');
const { createMediaSyncRouter } = await import('../routes/mediaSyncRouteShared.mjs');

function sweepClaims(overrides = {}) {
  return {
    id: 1, username: 'test-admin', role: 'admin', type: 'access',
    token_use: LOCAL_AI_POLICY_SWEEP_TOKEN_USE,
    aud: LOCAL_AI_POLICY_SWEEP_TOKEN_AUDIENCE,
    allowed_api_routes: LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES,
    ...overrides,
  };
}

describe.each([
  ['token-only', authenticateToken],
  ['token-or-API-key', authenticateTokenOrApiKey],
])('%s scoped JWT boundary', (_name, authenticate) => {
  let app, queueService, mediaSyncService, syncStatus, decisionWitnessReadService;

  beforeEach(() => {
    authService.verifyToken.mockReset();
    apiKeyService.validateApiKey.mockReset();
    apiKeyService.updateLastUsed.mockReset();
    apiKeyService.logAudit.mockReset();
    // Authentication is stubbed, not authorization: these are the claims of a
    // valid signed sweep token. The real mounted routers and guards run below.
    authService.verifyToken.mockResolvedValue(sweepClaims());
    apiKeyService.validateApiKey.mockResolvedValue(null);
    apiKeyService.updateLastUsed.mockResolvedValue(true);
    apiKeyService.logAudit.mockResolvedValue(true);
    queueService = {
      getPendingTasks: jest.fn().mockResolvedValue([]),
      getFailedTasks: jest.fn().mockResolvedValue([]),
      cancelAllPendingTasks: jest.fn().mockResolvedValue({ success: true, count: 0 }),
      cancelTask: jest.fn().mockResolvedValue({ success: true }),
    };
    decisionWitnessReadService = { read: jest.fn().mockResolvedValue({ taskId: 19 }) };
    mediaSyncService = {
      findExistingMedia: jest.fn().mockResolvedValue(null),
      syncLibrary: jest.fn().mockResolvedValue({ success: true }),
    };
    syncStatus = { tryStart: jest.fn().mockReturnValue({ started: true }), stop: jest.fn() };
    app = express();
    app.use(express.json(), cookieParser());
    app.use('/api/queue', createQueueRouter({
      express, queueService, logger: loggerModule.logger,
      authenticateTokenOrApiKey: authenticate, requireReadWrite, decisionWitnessReadService,
    }));
    app.use('/api/media-sync', createMediaSyncRouter({
      express, mediaSyncService, syncStatus, createLogger: () => loggerModule.logger,
      authenticateTokenOrApiKey: authenticate, requireReadWrite,
    }));
  });

  describe.each([
    ['bearer', { Authorization: 'Bearer synthetic-sweep-token' }],
    ['cookie', { Cookie: 'access_token=synthetic-sweep-token' }],
  ])('%s credential', (_source, headers) => {
    test('allows exact, prefix and template grants on public mounted paths', async () => {
      await request(app).get('/api/queue/pending?limit=5').set(headers).expect(200);
      await request(app).get('/api/queue/failed').set(headers).expect(200);
      await request(app).get('/api/queue/tasks/19/decision-witness').set(headers).expect(200);
      await request(app).get('/api/media-sync/lookup/42?mediaType=tv').set(headers).expect(200);
      expect(authService.verifyToken).toHaveBeenCalledTimes(4);
      expect(authService.verifyToken).toHaveBeenCalledWith('synthetic-sweep-token');
      expect(queueService.getPendingTasks).toHaveBeenCalledWith(5);
      expect(queueService.getFailedTasks).toHaveBeenCalledWith(20);
      expect(decisionWitnessReadService.read).toHaveBeenCalledWith(19);
      expect(mediaSyncService.findExistingMedia).toHaveBeenCalledWith(42, 'tv');
    });

    test.each([
      '/api/queue/cancel-all-pending',
      '/api/queue/task/19/cancel',
      '/api/media-sync/sync/1',
    ])('denies ungranted mutation %s before any work', async path => {
      const response = await request(app).post(path).set(headers).send({}).expect(403);
      expect(response.body).toEqual({ error: 'Scoped token cannot access this endpoint' });
      expect(queueService.cancelAllPendingTasks).not.toHaveBeenCalled();
      expect(queueService.cancelTask).not.toHaveBeenCalled();
      expect(syncStatus.tryStart).not.toHaveBeenCalled();
      expect(mediaSyncService.syncLibrary).not.toHaveBeenCalled();
    });

    test('keeps ordinary JWT access to the same mutation', async () => {
      authService.verifyToken.mockResolvedValue({ id: 1, role: 'admin', type: 'access' });
      await request(app).post('/api/queue/cancel-all-pending').set(headers).expect(200);
      expect(queueService.cancelAllPendingTasks).toHaveBeenCalledTimes(1);
    });
  });

  test.each([
    ['post', '/api/queue/pending'],
    ['get', '/api/queue/pending/'],
    ['get', '/api/queue/PENDING'],
    ['get', '/api/queue/%70ending'],
    ['get', '/api/queue/tasks/0/decision-witness'],
    ['get', '/api/queue/tasks/%31%39/decision-witness'],
    ['get', '/api/media-sync/lookup-sibling/42'],
    ['post', '/api/media-sync/lookup/42'],
    ['head', '/api/queue/pending'],
  ])('does not widen grants for %s %s', async (method, path) => {
    await request(app)[method](path).set('Authorization', 'Bearer synthetic-sweep-token').expect(403);
    expect(queueService.getPendingTasks).not.toHaveBeenCalled();
    expect(decisionWitnessReadService.read).not.toHaveBeenCalled();
    expect(mediaSyncService.findExistingMedia).not.toHaveBeenCalled();
  });

  test.each([undefined, null, [], {}, [null], [{ method: 'GET', path: '/api/queue/pending', match: 'unknown' }]].map(value => [value]))(
    'fails closed for missing or invalid route grants: %j', async allowedRoutes => {
      authService.verifyToken.mockResolvedValue(sweepClaims({ allowed_api_routes: allowedRoutes }));
      await request(app).get('/api/queue/pending').set('Authorization', 'Bearer synthetic-sweep-token').expect(403);
      expect(queueService.getPendingTasks).not.toHaveBeenCalled();
    },
  );

  test('rejects a scoped token with an incorrect audience', async () => {
    authService.verifyToken.mockResolvedValue(sweepClaims({ aud: 'other-audience' }));
    const response = await request(app).get('/api/queue/pending')
      .set('Authorization', 'Bearer synthetic-sweep-token').expect(403);
    expect(response.body).toEqual({ error: 'Invalid or expired token' });
    expect(queueService.getPendingTasks).not.toHaveBeenCalled();
  });

  test('does not fall back to an ordinary cookie when a scoped bearer is denied', async () => {
    authService.verifyToken.mockImplementation(async token => token === 'ordinary-cookie'
      ? { id: 1, role: 'admin' } : sweepClaims());
    await request(app).post('/api/queue/cancel-all-pending')
      .set('Authorization', 'Bearer synthetic-sweep-token')
      .set('Cookie', 'access_token=ordinary-cookie').expect(403);
    expect(authService.verifyToken).toHaveBeenCalledTimes(1);
    expect(authService.verifyToken).toHaveBeenCalledWith('synthetic-sweep-token');
    expect(queueService.cancelAllPendingTasks).not.toHaveBeenCalled();
  });
});

describe('combined authentication preserves independent API-key authority', () => {
  let app, mutation;

  beforeEach(() => {
    authService.verifyToken.mockReset();
    apiKeyService.validateApiKey.mockReset();
    apiKeyService.updateLastUsed.mockReset();
    apiKeyService.logAudit.mockReset();
    mutation = jest.fn().mockResolvedValue({ success: true });
    app = express();
    app.use('/api/queue', createQueueRouter({
      express, queueService: { cancelAllPendingTasks: mutation }, logger: loggerModule.logger,
      authenticateTokenOrApiKey, requireReadWrite,
    }));
    apiKeyService.updateLastUsed.mockResolvedValue(true);
    apiKeyService.logAudit.mockResolvedValue(true);
  });

  test.each([
    ['admin', 200], ['read_write', 200], ['read_only', 403], ['webhook_only', 403], ['embed_service', 403],
  ])('%s key retains its permissions when a scoped bearer is also present', async (permissions, status) => {
    apiKeyService.validateApiKey.mockResolvedValue({ id: 7, permissions });
    await request(app).post('/api/queue/cancel-all-pending')
      .set('X-API-Key', 'synthetic-key').set('Authorization', 'Bearer synthetic-sweep-token').expect(status);
    expect(authService.verifyToken).not.toHaveBeenCalled();
    expect(mutation).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
    expect(apiKeyService.updateLastUsed).toHaveBeenCalledTimes(permissions === 'embed_service' ? 0 : 1);
    expect(apiKeyService.logAudit).toHaveBeenCalledTimes(permissions === 'embed_service' ? 0 : 1);
  });

  test('does not fall back to JWT when an API key is invalid', async () => {
    apiKeyService.validateApiKey.mockResolvedValue(null);
    await request(app).post('/api/queue/cancel-all-pending')
      .set('X-API-Key', 'invalid-synthetic-key').set('Authorization', 'Bearer ordinary-token').expect(401);
    expect(authService.verifyToken).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
});
