/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/apiKeyAuth.mjs';
import { registerEvaluationHistoryRoutes } from '../routes/statsRouteEvaluationHistory.mjs';
import { evaluationHistoryFixture } from './fixtures/evaluationHistoryFixture.mjs';

function setup() {
  const client = { query: jest.fn(async () => ({ rows: [{ observed_at: '2026-09-25', result: evaluationHistoryFixture() }] })) };
  const db = { withTransaction: jest.fn(callback => callback(client)) };
  const app = express(), router = express.Router();
  app.use((req, _res, next) => { req.user = { role: req.get('x-test-role') || 'viewer' }; next(); });
  registerEvaluationHistoryRoutes(router, { db, requireAdmin, rateLimit });
  app.use('/api/stats', router);
  return { app, db, client };
}
test('administrator-only, parameter-free, no-store aggregate read with no private hashes or controls', async () => {
  const { app, db, client } = setup();
  const denied = await request(app).get('/api/stats/evaluation-history').expect(403);
  expect(denied.headers['cache-control']).toBe('no-store'); expect(db.withTransaction).not.toHaveBeenCalled();
  await request(app).get('/api/stats/evaluation-history?run=true').set('x-test-role', 'admin').expect(400);
  expect(db.withTransaction).not.toHaveBeenCalled();
  const response = await request(app).get('/api/stats/evaluation-history').set('x-test-role', 'admin').expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.groups[0]).toMatchObject({ paired: 25, labeled: 25, gains: 25 });
  expect(JSON.stringify(response.body)).not.toMatch(/[a-f0-9]{64}|PRIVATE|cases|item"/);
  expect(client.query.mock.calls.every(([sql]) => /^(SET|SELECT)/.test(sql))).toBe(true);
  await request(app).post('/api/stats/evaluation-history').set('x-test-role', 'admin').expect(404);
});
test('unavailable database or corrupt history fails closed without leaking details', async () => {
  const { app, db, client } = setup();
  client.query.mockResolvedValue({ rows: [{ observed_at: 'bad', result: {} }] });
  const invalid = await request(app).get('/api/stats/evaluation-history').set('x-test-role', 'admin').expect(503);
  expect(invalid.body).toEqual({ error: 'Evaluation history is unavailable' });
  db.withTransaction.mockRejectedValue(new Error('PRIVATE secret database error'));
  expect((await request(app).get('/api/stats/evaluation-history').set('x-test-role', 'admin').expect(503)).body).toEqual(invalid.body);
  expect(() => registerEvaluationHistoryRoutes(express.Router(), { db })).toThrow('protected');
});
