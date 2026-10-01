/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.mjs';
import { registerIngestionReconciliationRoutes } from '../routes/librariesRouteIngestionReconciliation.mjs';

function fixture(user = { id: 1, role: 'admin', type: 'access' }) {
  const service = { preview: jest.fn().mockResolvedValue({ revision: '"abc"' }), receipt: jest.fn().mockResolvedValue({ status: 'not_observed' }),
    history: jest.fn().mockResolvedValue({ receipts: [], limit: 20, hasMore: false }),
    confirm: jest.fn().mockResolvedValue({ receipt: { auditId: 7 } }) };
  const app = express(), router = express.Router();
  app.use(express.json(), (req, _res, next) => { req.user = user; next(); });
  registerIngestionReconciliationRoutes(router, { db: {}, service });
  app.use('/api/libraries', router); app.use(errorHandler);
  return { app, service };
}
const url = '/api/libraries/4/ingestion-reconciliation';
test.each([undefined, { role: 'viewer', type: 'access' }, { role: 'admin', type: 'refresh' }, { role: 'admin', type: 'access', token_use: 'scoped' }])('rejects a non-administrator access session %p', async user => {
  const { app, service } = fixture(user ?? null);
  for (const verb of ['get', 'post']) {
    const response = await request(app)[verb](url).expect(403);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect(service.preview).not.toHaveBeenCalled(); expect(service.confirm).not.toHaveBeenCalled();
  await request(app).get(`${url}/history`).expect(403);
  expect(service.history).not.toHaveBeenCalled();
});
test('requires no-store admin reads, rejects query/API-key controls and forwards exact conditional write', async () => {
  const { app, service } = fixture();
  const response = await request(app).get(url).expect(200);
  expect(response.headers.etag).toBe('"abc"'); expect(response.headers['cache-control']).toBe('no-store');
  await request(app).get(`${url}?force=true`).expect(400);
  await request(app).post(url).set('X-API-Key', 'synthetic').expect(403);
  const body = { requestId: 'synthetic-request', workersStopped: true };
  await request(app).post(url).set('If-Match', '"expected"').send(body).expect(200);
  expect(service.confirm).toHaveBeenCalledWith(1, '4', body, '"expected"');
  await request(app).post(url).set('If-Match', '"resume-review"').send({ ...body, resume: true }).expect(200);
  expect(service.confirm).toHaveBeenLastCalledWith(1, '4', { ...body, resume: true }, '"resume-review"');
  await request(app).get(`${url}/receipts/synthetic-request`).expect(200);
  expect(service.receipt).toHaveBeenCalledWith(1, '4', 'synthetic-request');
  const history = await request(app).get(`${url}/history`).expect(200);
  expect(history.headers['cache-control']).toBe('no-store');
  expect(service.history).toHaveBeenCalledWith(1, '4');
  await request(app).get(`${url}/history?actorId=2`).expect(400);
  await request(app).get(`${url}/history`).set('X-API-Key', 'synthetic').expect(403);
  expect(service.history).toHaveBeenCalledTimes(1);
});
