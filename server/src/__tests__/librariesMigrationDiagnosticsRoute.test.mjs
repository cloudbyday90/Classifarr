/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.mjs';
import { registerMigrationDiagnosticRoutes } from '../routes/librariesRouteMigrationDiagnostics.mjs';
const url = '/api/libraries/migration-diagnostics';
function fixture(user = { id: 1, role: 'admin', type: 'access' }) {
  const read = jest.fn(async () => ({ status: 'none' }));
  const app = express(), router = express.Router();
  app.use((req, _res, next) => { req.user = user; next(); });
  registerMigrationDiagnosticRoutes(router, { db: {}, read });
  app.use('/api/libraries', router); app.use(errorHandler);
  return { app, read };
}
test.each([null, { role: 'viewer', type: 'access' }, { role: 'admin', type: 'refresh' }, { role: 'admin', type: 'access', token_use: 'scoped' }])('rejects non-admin access authority %p', async user => {
  const { app, read } = fixture(user);
  const response = await request(app).get(url).expect(403);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(read).not.toHaveBeenCalled();
});
test('fixed no-store GET rejects API keys, arbitrary paths and mutation methods', async () => {
  const { app, read } = fixture();
  expect((await request(app).get(url).expect(200)).headers['cache-control']).toBe('no-store');
  expect(read).toHaveBeenCalledWith(1);
  await request(app).get(`${url}?path=/etc/passwd`).expect(400);
  await request(app).get(url).set('X-API-Key', 'synthetic').expect(403);
  await request(app).post(url).expect(404);
  expect(read).toHaveBeenCalledTimes(1);
});
