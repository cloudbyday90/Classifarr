/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { registerImageIndexProgressRoutes } from '../routes/statsRouteImageIndexProgress.mjs';
function fixture({ role = 'admin', limited = false } = {}) {
  const app = express();
  const getReport = jest.fn(async () => ({ status: 'verified' }));
  registerImageIndexProgressRoutes(app, { db: {}, createService: () => ({ getReport }),
    requireAdmin: (_req, res, next) => role === 'admin' ? next() : res.sendStatus(role ? 403 : 401),
    rateLimit: () => (_req, res, next) => limited ? res.sendStatus(429) : next(),
  });
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
  return { app, getReport };
}
test('authorized, uncached, parameter-free GET', async () => {
  const { app, getReport } = fixture();
  const response = await request(app).get('/image-index-progress').expect(200);
  expect(response.body).toEqual({ status: 'verified' });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(getReport).toHaveBeenCalledWith();
});
test.each([[{ role: null }, 401], [{ role: 'viewer' }, 403], [{ limited: true }, 429]])('denies %j before reading', async (options, code) => {
  const { app, getReport } = fixture(options);
  await request(app).get('/image-index-progress').expect(code);
  expect(getReport).not.toHaveBeenCalled();
});
test('rejects dimensions and has no mutation endpoint', async () => {
  const { app, getReport } = fixture();
  await request(app).get('/image-index-progress?force=true').expect(400);
  await request(app).post('/image-index-progress').expect(404);
  expect(getReport).not.toHaveBeenCalled();
});
test.each([{}, { requireAdmin: () => {} }])('requires security dependencies', options => {
  expect(() => registerImageIndexProgressRoutes(express.Router(), options)).toThrow('requires administrator');
});
