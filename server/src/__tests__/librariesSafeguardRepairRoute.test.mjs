/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.mjs';
import { registerSafeguardRepairRoutes } from '../routes/librariesRouteSafeguardRepair.mjs';
function fixture(user = { id: 1, role: 'admin', type: 'access' }) {
  const service = { preview: jest.fn(async () => ({ reason: 'not_needed' })), apply: jest.fn(async () => ({ status: 'repaired' })) };
  const app = express(), router = express.Router();
  app.use(express.json(), (req, _res, next) => { req.user = user; next(); });
  registerSafeguardRepairRoutes(router, { db: {}, service });
  app.use('/api/libraries', router); app.use(errorHandler);
  return { app, service };
}
const url = '/api/libraries/ingestion-safeguards';
test.each([null, { role: 'viewer', type: 'access' }, { role: 'admin', type: 'refresh' }, { role: 'admin', type: 'access', token_use: 'scoped' }])('rejects non-admin access authority %p', async user => {
  const { app, service } = fixture(user);
  for (const method of ['get', 'post']) await request(app)[method](url).expect(403);
  expect(service.preview).not.toHaveBeenCalled(); expect(service.apply).not.toHaveBeenCalled();
});
test('uses no-store administrator preview, rejects parameters/API keys, forwards confirmed body only on POST', async () => {
  const { app, service } = fixture();
  expect((await request(app).get(url).expect(200)).headers['cache-control']).toBe('no-store');
  expect(service.apply).not.toHaveBeenCalled();
  await request(app).get(`${url}?force=true`).expect(400);
  await request(app).post(url).set('X-API-Key', 'synthetic').expect(403);
  const body = { token: 'synthetic', confirm: true };
  await request(app).post(url).send(body).expect(200);
  expect(service.apply).toHaveBeenCalledTimes(1);
  expect(service.apply).toHaveBeenCalledWith(1, body);
});
