/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.mjs';
import { registerLegacyRetryRoutes } from '../routes/librariesRouteLegacyRetries.mjs';
function fixture(user = { id: 1, role: 'admin', type: 'access' }) {
  const service = { preview: jest.fn().mockResolvedValue({ revision: '"abc"' }), receipt: jest.fn().mockResolvedValue({ receipt: null }),
    confirm: jest.fn().mockResolvedValue({ receipt: { auditId: 7 } }) };
  const app = express(), router = express.Router();
  app.use(express.json(), (req, _res, next) => { req.user = user; next(); });
  registerLegacyRetryRoutes(router, { db: {}, service });
  app.use('/api/libraries', router); app.use(errorHandler);
  return { app, service };
}
const url = '/api/libraries/4/legacy-enrichment-retries';
test.each([null, { role: 'user', type: 'access' }, { role: 'admin', type: 'refresh' }, { role: 'admin', type: 'access', token_use: 'scoped' }])('rejects unauthorized session %p', async user => {
  const { app, service } = fixture(user);
  for (const verb of ['get', 'post']) expect((await request(app)[verb](url).expect(403)).headers['cache-control']).toBe('no-store');
  await request(app).get(`${url}/receipts/example`).expect(403);
  expect(service.preview).not.toHaveBeenCalled(); expect(service.confirm).not.toHaveBeenCalled(); expect(service.receipt).not.toHaveBeenCalled();
});
test('no-store, exact revision, named receipt endpoint; no API-key or query authority', async () => {
  const { app, service } = fixture();
  const response = await request(app).get(url).expect(200);
  expect(response.headers.etag).toBe('"abc"'); expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers.vary).toContain('Authorization');
  await request(app).get(`${url}?force=true`).expect(400);
  await request(app).post(url).set('X-API-Key', 'synthetic').expect(403);
  const body = { requestId: 'synthetic', workersStopped: true };
  await request(app).post(url).set('If-Match', '"review"').send(body).expect(200);
  expect(service.confirm).toHaveBeenCalledWith(1, '4', body, '"review"');
  await request(app).get(`${url}/receipts/synthetic`).expect(200);
  expect(service.receipt).toHaveBeenCalledWith(1, '4', 'synthetic');
});
