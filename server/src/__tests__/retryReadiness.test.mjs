/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { classifyRetryReadinessRow, summarizeRetryReadiness } from '../services/retryReadinessSummary.mjs';
import { createRetryReadinessService } from '../services/retryReadinessService.mjs';
import { readRetryReadinessPage } from '../services/retryReadinessRepository.mjs';
import { registerRetryReadinessRoute } from '../routes/queueRouteRetryReadiness.mjs';

const now = Date.parse('2026-09-29T20:00:00Z');
const row = { item_eligible: true, candidate: true, next_attempt_at: new Date(now - 1) };
test.each([
  [{ item_eligible: false, credentials_blocked: true }, 'held'],
  [{ credentials_blocked: true }, 'settings_blocked'],
  [{ next_attempt_at: new Date(now + 1000) }, 'scheduled'],
  [{ monthly_due_at: new Date(now + 1000) }, 'scheduled'],
  [{ cooldown_until: new Date(now + 1000) }, 'provider_wait'],
  [{ candidate: false }, 'held'],
])('queue gate %j cannot be overridden by cache hints', (override, reason) => {
  expect(classifyRetryReadinessRow({ ...row, ...override }, now)?.reason).toBe(reason);
});

test('partitions observed rows, discloses coverage and does not return content', async () => {
  const inspect = jest.fn(async item => ({ reason: item.queue_id === 1 ? 'cached_ready' : 'provider_ready' }));
  const factory = jest.fn(async () => inspect);
  const report = await summarizeRetryReadiness([{ hasMore: true, rows: [
    { ...row, queue_id: 1, title: 'private' }, { ...row, queue_id: 2 },
    { ...row, credentials_blocked: true }, { ...row, item_eligible: false },
    { ...row, next_attempt_at: new Date(now + 1000) },
    { ...row, cooldown_until: new Date(now + 2000) },
  ] }], factory, now);
  expect(report.counts).toEqual({ cached_ready: 1, provider_ready: 1, settings_blocked: 1, held: 1, scheduled: 1, provider_wait: 1 });
  expect(report).toMatchObject({ inspected: 6, hasMore: true, earliestRetryAt: new Date(now + 1000).toISOString() });
  expect(inspect).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(report)).not.toMatch(/private|queue_id|title/);
});

test('empty setup does not inspect providers; unknown reasons fail closed', async () => {
  const inspect = jest.fn();
  expect((await summarizeRetryReadiness([{ rows: [], hasMore: false }], inspect, now)).inspected).toBe(0);
  expect(inspect).not.toHaveBeenCalled();
  await expect(summarizeRetryReadiness([{ rows: [row] }], async () => async () => ({ reason: 'secret' }), now)).rejects.toThrow('invalid_readiness_reason');
});

test('page query bounds rows before guards and rejects unsupported scope', async () => {
  const db = { query: jest.fn(async () => ({ rows: Array(51).fill(row) })) };
  expect(await readRetryReadinessPage(db, 'web_search')).toMatchObject({ rows: Array(50).fill(row), hasMore: true });
  expect(db.query.mock.calls[0][0]).toContain('AS MATERIALIZED');
  expect(db.query.mock.calls[0][1].at(-1)).toBe(51);
  await expect(readRetryReadinessPage(db, 'music')).rejects.toThrow('unsupported_readiness_type');
});

test('read-only transaction, single-flight and short cache preserve original observation time', async () => {
  let clock = now;
  const query = jest.fn(async () => ({ rows: [] }));
  const database = { withTransaction: jest.fn(async fn => fn({ query })) };
  const service = createRetryReadinessService({ database, now: () => clock, createRouter: () => ({}) });
  const [first, second] = await Promise.all([service.getReport(), service.getReport()]);
  expect(first).toEqual(second); expect(database.withTransaction).toHaveBeenCalledTimes(1);
  expect(query.mock.calls.slice(0, 4).map(([sql]) => sql)).toEqual([
    'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY',
    "SET LOCAL statement_timeout = '2000ms'", "SET LOCAL lock_timeout = '250ms'",
    "SET LOCAL idle_in_transaction_session_timeout = '5000ms'",
  ]);
  clock += 29_000; expect(await service.getReport()).toEqual(first);
  clock += 1001; expect((await service.getReport()).observedAt).not.toBe(first.observedAt);
  expect(database.withTransaction).toHaveBeenCalledTimes(2);
  clock = now - 1000;
  expect((await service.getReport()).observedAt).toBe(new Date(clock).toISOString());
  expect(database.withTransaction).toHaveBeenCalledTimes(3);
});

test('failed reads release single-flight state and are not cached as healthy zero', async () => {
  const database = { withTransaction: jest.fn().mockRejectedValueOnce(new Error('secret')).mockImplementation(async fn => fn({ query: async () => ({ rows: [] }) })) };
  const service = createRetryReadinessService({ database, createRouter: () => ({}) });
  await expect(service.getReport()).rejects.toThrow('secret');
  expect((await service.getReport()).inspected).toBe(0);
});

test('route enforces authorization, no-store and sanitized failures', async () => {
  const getReport = jest.fn(async () => ({ version: 1 }));
  const app = express(), router = express.Router();
  const limiter = jest.fn((_req, _res, next) => next());
  registerRetryReadinessRoute(router, { service: { getReport }, limiter,
    requireAdmin: (req, res, next) => req.headers.authorization === 'fixture-admin' ? next() : res.sendStatus(403) });
  app.use('/queue', router);
  await request(app).get('/queue/retry-readiness').expect(403);
  expect(getReport).not.toHaveBeenCalled(); expect(limiter).not.toHaveBeenCalled();
  const response = await request(app).get('/queue/retry-readiness').set('Authorization', 'fixture-admin').expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers.vary).toBe('Authorization');
  getReport.mockRejectedValue(new Error('private provider key'));
  const failure = await request(app).get('/queue/retry-readiness').set('Authorization', 'fixture-admin').expect(503);
  expect(JSON.stringify(failure.body)).not.toContain('private');
});
