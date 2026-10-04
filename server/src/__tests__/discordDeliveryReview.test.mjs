/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createDiscordDeliveryReviewHandler } from '../routes/helpers/discordDeliveryReviewHandler.mjs';
import { registerNotificationRoutes } from '../routes/settingsRouteDiscord.mjs';

const verifyToken = jest.fn();
jest.unstable_mockModule('../services/auth.mjs', () => ({ verifyToken }));
const { authenticateToken, requireAdmin } = await import('../middleware/auth.mjs');
const query = jest.fn();
const db = { withTransaction: jest.fn(fn => fn({ query })) };
let app;

beforeEach(() => {
  jest.clearAllMocks();
  query.mockReset().mockResolvedValue({ rows: [] });
  db.withTransaction.mockImplementation(fn => fn({ query }));
  verifyToken.mockResolvedValue({ role: 'admin' });
  const noop = (_req, res) => res.sendStatus(204);
  const router = express.Router();
  registerNotificationRoutes(router, { requireAdmin, discordHandlers: {
    getDeliveries: createDiscordDeliveryReviewHandler(db),
    getConfig: noop, updateConfig: noop, testConnection: noop, verifyDelivery: noop,
    getServers: noop, getChannels: noop, getMentionTargets: noop, getChannelDetails: noop,
  } });
  app = express().use('/api/settings', authenticateToken, requireAdmin, router);
});
const get = (queryString = '') => request(app).get(`/api/settings/discord/deliveries${queryString}`).set('Authorization', 'Bearer fixture');

test('real route authenticates and requires an administrator before database access', async () => {
  expect((await request(app).get('/api/settings/discord/deliveries')).status).toBe(401);
  verifyToken.mockResolvedValue({ role: 'user' });
  expect((await get()).status).toBe(403);
  verifyToken.mockRejectedValue(new Error('private token detail'));
  expect((await get()).status).toBe(403);
  expect(db.withTransaction).not.toHaveBeenCalled();
});

test.each(['0', '-1', '01', '1.2', '1e2', '9223372036854775808', '1;DROP TABLE x', 'x'.repeat(100)])('rejects invalid cursor %s', async cursor => {
  expect((await get(`?before=${encodeURIComponent(cursor)}`)).status).toBe(400);
  expect(db.withTransaction).not.toHaveBeenCalled();
});

test('rejects repeated query values', async () => {
  expect((await get('?before=1&before=2')).status).toBe(400);
  expect(db.withTransaction).not.toHaveBeenCalled();
});

test('empty reads are bounded, non-cacheable and never inspect provider configuration', async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toEqual({ items: [], nextBefore: null });
  expect(query.mock.calls.slice(0, 3)).toEqual([
    ['SET TRANSACTION READ ONLY'], ["SET LOCAL statement_timeout = '3s'"], ["SET LOCAL lock_timeout = '1s'"],
  ]);
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('LIMIT 26'), ['9223372036854775807']);
  expect(JSON.stringify(query.mock.calls)).not.toMatch(/notification_config|UPDATE|INSERT|DELETE/);
});

test('returns 25 allowlisted records and an exact string cursor', async () => {
  query.mockImplementation(async sql => ({ rows: sql.includes('SELECT d.') ?
    Array.from({ length: 26 }, (_, i) => ({ classificationId: String(100 - i), title: 'Fixture',
      state: 'sending', channelId: '222222222222222222', messageId: null, kind: 'pending',
      createdAt: null, updatedAt: null, nonce: 'private', bot_token: 'private', metadata: 'private' })) : [] }));
  const result = await get('?before=9007199254740993');
  expect(result.body.items).toHaveLength(25);
  expect(result.body.nextBefore).toBe('76');
  expect(JSON.stringify(result.body)).not.toContain('private');
  expect(query).toHaveBeenLastCalledWith(expect.any(String), ['9007199254740993']);
});

test('sanitizes failures and releases admission for another read', async () => {
  db.withTransaction.mockRejectedValueOnce(new Error('postgres://secret/credentials'));
  const result = await get();
  expect(result.status).toBe(503);
  expect(JSON.stringify(result.body)).not.toContain('secret');
  expect((await get()).status).toBe(200);
});

test('admits four concurrent reads with no unbounded queue', async () => {
  const deferred = Promise.withResolvers();
  const admitted = Promise.withResolvers();
  db.withTransaction.mockImplementation(() => {
    if (db.withTransaction.mock.calls.length === 4) admitted.resolve();
    return deferred.promise;
  });
  const requests = Array.from({ length: 4 }, () => get().then(res => res));
  await admitted.promise;
  expect((await get()).status).toBe(503);
  expect(db.withTransaction).toHaveBeenCalledTimes(4);
  deferred.resolve({ items: [], nextBefore: null });
  expect((await Promise.all(requests)).every(res => res.status === 200)).toBe(true);
});
