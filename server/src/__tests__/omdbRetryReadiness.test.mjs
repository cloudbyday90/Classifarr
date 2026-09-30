/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { readOmdbQuotaReadiness } from '../services/omdbQuotaStore.mjs';
import { summarizeOmdbRetryReadiness } from '../services/omdbRetryReadiness.mjs';
import { createRetryReadinessService } from '../services/retryReadinessService.mjs';
import { registerRetryReadinessRoute } from '../routes/queueRouteRetryReadiness.mjs';
const now = Date.parse('2026-09-29T10:00:00Z');
const config = { api_key: 'private-fixture', daily_limit: 100, requests_today: 10,
  quota_day: '2026-09-29', last_reset_date: '2026-09-29' };
const dbFor = value => ({ query: jest.fn(async () => ({ rows: value ? [value] : [] })) });
const item = { queue_id: 1, title: 'Private title', item_eligible: true, candidate: true };

test.each([
  [null, 'not_configured'], [{ ...config, api_key: ' ' }, 'not_configured'],
  [{ ...config, credential_rejected_at: new Date() }, 'credentials_rejected'],
  [{ ...config, daily_limit: 0 }, 'invalid_configuration'],
  [{ ...config, requests_today: -1 }, 'invalid_configuration'],
  [{ ...config, last_reset_date: '2026-10-01' }, 'invalid_configuration'],
])('unsafe OMDb config projects no fictitious zero budget: %j', async (value, status) => {
  expect(await readOmdbQuotaReadiness(dbFor(value))).toEqual({ status, used: null, limit: null, resetAt: null });
});

test('read-only quota projection resets dated prior days logically and preserves undated counts', async () => {
  expect(await readOmdbQuotaReadiness(dbFor({ ...config, last_reset_date: '2026-09-28', requests_today: 100 })))
    .toEqual({ status: 'available', used: 0, limit: 100, resetAt: '2026-09-30T00:00:00.000Z' });
  expect(await readOmdbQuotaReadiness(dbFor({ ...config, last_reset_date: null, requests_today: 100 })))
    .toEqual({ status: 'limit_reached', used: 100, limit: 100, resetAt: null });
});

test('OMDb shares queue guards but never treats a cache as readiness or returns private data', async () => {
  const report = await summarizeOmdbRetryReadiness(dbFor(config), { rows: [item,
    { ...item, item_eligible: false }, { ...item, credentials_blocked: true },
    { ...item, next_attempt_at: new Date(now + 1000) }, { ...item, cooldown_until: new Date(now + 2000) },
    { ...item, title: null, imdb_id: null }], hasMore: false }, now);
  expect(report).toMatchObject({ scope: 'omdb', inspected: 6,
    counts: { cached_ready: 0, provider_ready: 1, held: 2, settings_blocked: 1, scheduled: 1, provider_wait: 1 } });
  expect(JSON.stringify(report)).not.toMatch(/private|Private|api_key|queue_id/);
});

test.each([null, '2026-09-29'])('quota waits bound queue timing without resetting legacy counters: %s', async date => {
  const report = await summarizeOmdbRetryReadiness(dbFor({ ...config, requests_today: 100, last_reset_date: date }),
    { rows: [item, { ...item, next_attempt_at: new Date(now + 1000) }] }, now);
  expect(report.counts).toMatchObject({ provider_wait: 1, scheduled: 1, provider_ready: 0 });
  expect(report.earliestRetryAt).toBe(date ? '2026-09-30T00:00:00.000Z' : null);
});

test('unconfigured OMDb cannot advertise a queue due time as a recovery estimate', async () => {
  const report = await summarizeOmdbRetryReadiness(dbFor(null), { rows: [item,
    { ...item, next_attempt_at: new Date(now + 1000) }] }, now);
  expect(report.counts.settings_blocked).toBe(1); expect(report.earliestRetryAt).toBeNull();
});

test('shared pacing holds the earliest estimate even when a different row is due sooner', async () => {
  const retryAt = new Date(now + 120000).toISOString();
  const db = { query: jest.fn(async sql => ({ rows: sql.includes('FROM omdb_request_pacing')
    ? [{ wait: 120, retry_at: retryAt }] : [config] })) };
  const report = await summarizeOmdbRetryReadiness(db,
    { rows: [item, { ...item, next_attempt_at: new Date(now + 1000) }] }, now);
  expect(report.counts).toMatchObject({ provider_wait: 1, scheduled: 1, provider_ready: 0 });
  expect(report.earliestRetryAt).toBe(retryAt); expect(report.quota.status).toBe('available');
});

test('OMDb uses its own reader and independent single-flight cache without constructing a web router', async () => {
  const query = jest.fn(async sql => ({ rows: sql.includes('FROM omdb_config') ? [config] : [] }));
  const database = { withTransaction: jest.fn(async fn => fn({ query })) }, createRouter = jest.fn();
  const service = createRetryReadinessService({ database, createRouter, scope: 'omdb', now: () => now });
  const reports = await Promise.all([service.getReport(), service.getReport()]);
  expect(reports[0].scope).toBe('omdb'); expect(reports[0]).toEqual(reports[1]);
  expect(database.withTransaction).toHaveBeenCalledTimes(1); expect(createRouter).not.toHaveBeenCalled();
  expect(query.mock.calls.find(([sql]) => sql.includes('AS MATERIALIZED'))[1][0]).toBe('omdb');
  expect(() => createRetryReadinessService({ scope: 'music' })).toThrow('unsupported_readiness_scope');
});

test('the fixed OMDb route shares admin/rate-limit checks and sanitizes failures', async () => {
  const app = express(), router = express.Router(), web = { getReport: jest.fn() };
  const omdb = { getReport: jest.fn(async () => ({ scope: 'omdb' })) };
  const limiter = jest.fn((_req, _res, next) => next());
  registerRetryReadinessRoute(router, { service: web, omdbService: omdb, limiter,
    requireAdmin: (req, res, next) => req.headers.authorization === 'admin-fixture' ? next() : res.sendStatus(403) });
  app.use(router);
  await request(app).get('/omdb-retry-readiness').expect(403);
  expect(omdb.getReport).not.toHaveBeenCalled(); expect(limiter).not.toHaveBeenCalled();
  const response = await request(app).get('/omdb-retry-readiness').set('Authorization', 'admin-fixture').expect(200);
  expect(response.headers['cache-control']).toBe('no-store'); expect(web.getReport).not.toHaveBeenCalled();
  omdb.getReport.mockRejectedValue(new Error('private-key'));
  const failure = await request(app).get('/omdb-retry-readiness').set('Authorization', 'admin-fixture').expect(503);
  expect(JSON.stringify(failure.body)).not.toContain('private');
});
