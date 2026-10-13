/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { registerQueueMetadataCheckRoute } from '../routes/queueRouteMetadataCheck.mjs';

const verifyToken = jest.fn();
const validateApiKey = jest.fn();
jest.unstable_mockModule('../services/auth.mjs', () => ({ verifyToken }));
jest.unstable_mockModule('../services/apiKeyService.mjs', () => ({
  validateApiKey, updateLastUsed: jest.fn(), logAudit: jest.fn(),
}));
jest.unstable_mockModule('../config/runtimeSettings.mjs', () => ({ getValue: () => true }));
const { authenticateTokenOrApiKey, requireAdmin } = await import('../middleware/apiKeyAuth.mjs');
const { csrfProtection } = await import('../middleware/csrf.mjs');
let app, service;
const path = '/api/queue/task/23/metadata-check';
beforeEach(() => {
  verifyToken.mockReset().mockResolvedValue({ id: 7, role: 'admin', type: 'access' });
  validateApiKey.mockReset();
  service = { check: jest.fn().mockResolvedValue({ taskId: '23' }) };
  app = express(); app.use(express.json(), cookieParser(), csrfProtection);
  const router = express.Router(); router.use(authenticateTokenOrApiKey);
  registerQueueMetadataCheckRoute(router, { requireAdmin, service,
    limiter: rateLimit({ windowMs: 60000, limit: 5, standardHeaders: true, legacyHeaders: false }) });
  app.use('/api/queue', router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: 'request failed' }));
});
test('requires authentication, ordinary admin session and matching cookie CSRF', async () => {
  await request(app).post(path).send({}).expect(401);
  await request(app).post(path).set('Cookie', 'access_token=test').send({}).expect(403);
  const result = await request(app).post(path).set('Cookie', 'access_token=test; classifarr_csrf_token=csrf-test')
    .set('x-csrf-token', 'csrf-test').send({}).expect(200);
  expect(result.headers['cache-control']).toBe('no-store');
  expect(result.headers.vary).toContain('Cookie');
  expect(service.check).toHaveBeenCalledTimes(1);
  expect(service.check).toHaveBeenCalledWith(7, '23', {}, expect.any(AbortSignal));
});
test.each([{ id: 7, type: 'access', role: 'user' }, { id: 7, type: 'refresh', role: 'admin' },
  { id: 7, type: 'access', role: 'admin', token_use: 'diagnostic' }])('rejects principal %j', async principal => {
  verifyToken.mockResolvedValue(principal);
  await request(app).post(path).set('Authorization', 'Bearer test').send({}).expect(403);
  expect(service.check).not.toHaveBeenCalled();
});
test('rejects API-key header even with a valid session', async () => {
  await request(app).post(path).set('Authorization', 'Bearer test').set('x-api-key', 'test').send({}).expect(401);
  expect(service.check).not.toHaveBeenCalled();
});

test('rejects an otherwise valid administrator API key', async () => {
  validateApiKey.mockResolvedValue({ id: 3, permissions: 'admin' });
  await request(app).post(path).set('x-api-key', 'test').send({}).expect(403);
  expect(service.check).not.toHaveBeenCalled();
});
test('GET does not perform checks and repeated POST is bounded', async () => {
  await request(app).get(path).set('Authorization', 'Bearer test').expect(404);
  expect(service.check).not.toHaveBeenCalled();
  for (let i = 0; i < 5; i++) await request(app).post(path).set('Authorization', 'Bearer test').send({}).expect(200);
  await request(app).post(path).set('Authorization', 'Bearer test').send({}).expect(429);
  expect(service.check).toHaveBeenCalledTimes(5);
});
