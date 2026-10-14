/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { get } from 'node:http';
import { once } from 'node:events';
import { registerQueueIdentityRepairRoutes } from '../routes/queueRouteIdentityRepair.mjs';

const verifyToken = jest.fn();
const validateApiKey = jest.fn();
jest.unstable_mockModule('../services/auth.mjs', () => ({ verifyToken }));
jest.unstable_mockModule('../services/apiKeyService.mjs', () => ({ validateApiKey, updateLastUsed: jest.fn(), logAudit: jest.fn() }));
jest.unstable_mockModule('../config/runtimeSettings.mjs', () => ({ getValue: () => true }));
const { authenticateTokenOrApiKey, requireAdmin } = await import('../middleware/apiKeyAuth.mjs');
const { csrfProtection } = await import('../middleware/csrf.mjs');
let app, service, backfill;
const path = '/api/queue/task/23/identity-repair';
beforeEach(() => {
  verifyToken.mockReset().mockResolvedValue({ id: 7, role: 'admin', type: 'access' });
  validateApiKey.mockReset();
  service = Object.fromEntries(['preview', 'confirm', 'retry', 'receipt'].map(key => [key, jest.fn().mockResolvedValue({ receipt: null })]));
  backfill = { list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }), run: jest.fn().mockResolvedValue({ receipts: [] }) };
  app = express(); app.use(express.json(), cookieParser(), csrfProtection);
  const router = express.Router(); router.use(authenticateTokenOrApiKey);
  registerQueueIdentityRepairRoutes(router, { requireAdmin, service, backfill,
    limiter: rateLimit({ windowMs: 60000, limit: 5, standardHeaders: true, legacyHeaders: false }),
    readLimiter: rateLimit({ windowMs: 60000, limit: 20, standardHeaders: true, legacyHeaders: false }) });
  app.use('/api/queue', router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: 'request failed' }));
});

const batchPath = '/api/queue/identity-repair/backfill';
test('batch discovery is a no-store read; enqueue requires cookie CSRF and passes cancellation', async () => {
  await request(app).get(batchPath).expect(401);
  const response = await request(app).get(`${batchPath}?afterId=23`).set('Authorization', 'Bearer test').expect(200);
  expect(backfill.list).toHaveBeenCalledWith(7, { afterId: '23' }, expect.any(AbortSignal));
  expect(response.headers['cache-control']).toBe('no-store');
  expect(backfill.run).not.toHaveBeenCalled();
  await request(app).post(batchPath).set('Cookie', 'access_token=test').send({}).expect(403);
  await request(app).post(batchPath).set('Cookie', 'access_token=test; classifarr_csrf_token=csrf-test')
    .set('x-csrf-token', 'csrf-test').send({ confirmRetry: true }).expect(200);
  expect(backfill.run).toHaveBeenCalledWith(7, { confirmRetry: true }, expect.any(AbortSignal));
});

test('readiness projection passes through HTTP without raw errors and shares the read limiter', async () => {
  const data = { items: [{ taskId: '23', readiness: { status: 'blocked', reason: 'provider_changed' } }],
    nextCursor: null, checkedAt: '2026-10-13T23:00:00Z' };
  backfill.list.mockResolvedValueOnce(data);
  const response = await request(app).get(batchPath).set('Authorization', 'Bearer test').expect(200);
  expect(response.body).toEqual(data);
  backfill.list.mockRejectedValueOnce(new Error('private provider value'));
  const failure = await request(app).get(batchPath).set('Authorization', 'Bearer test').expect(500);
  expect(JSON.stringify(failure.body)).not.toContain('private');
  for (let i = 0; i < 18; i++) await request(app).get(path).set('Authorization', 'Bearer test').expect(200);
  await request(app).get(batchPath).set('Authorization', 'Bearer test').expect(429);
  expect(backfill.list).toHaveBeenCalledTimes(2);
});

test('disconnecting a real HTTP readiness request cancels the service read', async () => {
  const started = Promise.withResolvers();
  backfill.list.mockImplementationOnce(async (_actor, _query, signal) => {
    started.resolve(signal);
    await once(signal, 'abort', { signal: AbortSignal.timeout(3000) });
    return { items: [], nextCursor: null };
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = get({ host: '127.0.0.1', port: server.address().port, path: batchPath,
    headers: { Authorization: 'Bearer test' } });
  client.on('error', () => {});
  try {
    const signal = await started.promise;
    const aborted = once(signal, 'abort', { signal: AbortSignal.timeout(3000) });
    client.destroy();
    await aborted;
    expect(signal.aborted).toBe(true);
    expect(backfill.run).not.toHaveBeenCalled();
  } finally {
    client.destroy(); server.closeAllConnections();
    await new Promise(resolve => { server.close(resolve); });
  }
});
test.each([{ role: 'user', type: 'access' }, { role: 'admin', type: 'refresh' },
  { role: 'admin', type: 'access', token_use: 'diagnostic' }])('batch rejects principal %j', async principal => {
  verifyToken.mockResolvedValue({ id: 7, ...principal });
  await request(app).get(batchPath).set('Authorization', 'Bearer test').expect(403);
  await request(app).post(batchPath).set('Authorization', 'Bearer test').send({}).expect(403);
  expect(backfill.list).not.toHaveBeenCalled(); expect(backfill.run).not.toHaveBeenCalled();
});
test('batch rejects API keys and shares the manual mutation limit', async () => {
  validateApiKey.mockResolvedValue({ id: 3, permissions: 'admin' });
  await request(app).get(batchPath).set('x-api-key', 'test').expect(403);
  await request(app).post(batchPath).set('x-api-key', 'test').send({}).expect(403);
  for (let i = 0; i < 5; i++) await request(app).post(`${path}/retry`).set('Authorization', 'Bearer test').send({}).expect(200);
  await request(app).post(batchPath).set('Authorization', 'Bearer test').send({}).expect(429);
  await request(app).get(batchPath).set('Authorization', 'Bearer test').expect(200);
  expect(backfill.run).not.toHaveBeenCalled();
});

test.each(['preview', 'confirm', 'retry'])('%s requires authentication and matching cookie CSRF', async action => {
  await request(app).post(`${path}/${action}`).send({}).expect(401);
  await request(app).post(`${path}/${action}`).set('Cookie', 'access_token=test').send({}).expect(403);
  const response = await request(app).post(`${path}/${action}`).set('Cookie', 'access_token=test; classifarr_csrf_token=csrf-test')
    .set('x-csrf-token', 'csrf-test').send({}).expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers.vary).toContain('Cookie');
  expect(service[action]).toHaveBeenCalledWith(7, '23', {}, expect.any(AbortSignal));
  expect(service[action]).toHaveBeenCalledTimes(1);
});

test.each([{ role: 'user', type: 'access' }, { role: 'admin', type: 'refresh' },
  { role: 'admin', type: 'access', token_use: 'diagnostic' }])('all endpoints reject principal %j', async principal => {
  verifyToken.mockResolvedValue({ id: 7, ...principal });
  for (const action of ['preview', 'confirm', 'retry']) await request(app).post(`${path}/${action}`).set('Authorization', 'Bearer test').send({}).expect(403);
  await request(app).get(path).set('Authorization', 'Bearer test').expect(403);
  for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
});

test('administrator API keys are not repair or receipt authority', async () => {
  validateApiKey.mockResolvedValue({ id: 3, permissions: 'admin' });
  for (const action of ['preview', 'confirm', 'retry']) await request(app).post(`${path}/${action}`).set('x-api-key', 'test').send({}).expect(403);
  await request(app).get(path).set('x-api-key', 'test').expect(403);
  expect(service.preview).not.toHaveBeenCalled();
});

test('GET reads only the receipt and mutation routes do not allow GET', async () => {
  const response = await request(app).get(path).set('Authorization', 'Bearer test').expect(200);
  expect(response.body).toEqual({ receipt: null });
  expect(service.receipt).toHaveBeenCalledWith(7, '23');
  expect(response.headers['cache-control']).toBe('no-store');
  for (const action of ['preview', 'confirm', 'retry']) {
    await request(app).get(`${path}/${action}`).set('Authorization', 'Bearer test').expect(404);
    expect(service[action]).not.toHaveBeenCalled();
  }
});

test('review and retry share a bounded mutation rate; receipt remains readable', async () => {
  for (const action of ['preview', 'confirm', 'retry', 'preview', 'confirm']) await request(app).post(`${path}/${action}`).set('Authorization', 'Bearer test').send({}).expect(200);
  await request(app).post(`${path}/retry`).set('Authorization', 'Bearer test').send({}).expect(429);
  await request(app).get(path).set('Authorization', 'Bearer test').expect(200);
});
