/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { validVerificationInput, verificationConfigMatches, verificationRetrySeconds } from '../services/discordDeliveryVerificationContract.mjs';
import { createDiscordDeliveryVerificationService } from '../services/discordDeliveryVerificationService.mjs';
import { createDiscordDeliveryVerificationHandler } from '../routes/helpers/discordDeliveryVerificationHandler.mjs';
import { registerNotificationRoutes } from '../routes/settingsRouteDiscord.mjs';

const messageId = '333333333333333333';
const config = { id: 1, enabled: true, bot_token: 'synthetic', channel_id: '222222222222222222', verification_revision: 'exact' };
function setup() {
  const repository = { admit: jest.fn().mockResolvedValue({ code: 'admitted', config, operationId: 'id' }), finish: jest.fn() };
  const deliveries = { complete: jest.fn().mockResolvedValue(true) };
  const read = jest.fn().mockResolvedValue({ code: 'verified', proof: { messageId } });
  const logger = { info: jest.fn() };
  return { repository, deliveries, read, logger,
    verify: createDiscordDeliveryVerificationService({ repository, deliveries, read, logger }) };
}

test.each(['0', '01', '-1', '1e2', '9223372036854775808', 91, undefined])('rejects invalid classification %s', id => {
  expect(validVerificationInput(id, { messageId })).toBeFalsy();
});
test.each([null, [], {}, { messageId: 3 }, { messageId: '3'.repeat(21) }, { messageId, channelId: 'other' }, { messageId, bot_token: 'private' }])('strict body %j', body => {
  expect(validVerificationInput('91', body)).toBeFalsy();
});
test('exact bigint IDs accepted and snapshots require enabled exact values', () => {
  expect(validVerificationInput('9223372036854775807', { messageId })).toBe(true);
  expect(verificationConfigMatches(config, { ...config })).toBe(true);
  for (const key of ['id', 'enabled', 'bot_token', 'channel_id', 'verification_revision']) {
    expect(verificationConfigMatches({ ...config, [key]: null }, config)).toBe(false);
  }
  expect(verificationConfigMatches(null, config)).toBe(false);
});
test.each([[0, 60], ['65.2', 66], [999999999, null], [null, null], ['', null], ['bad', null], [-1, null], [Infinity, null]])('retry limit %s yields %s', (value, result) => {
  expect(verificationRetrySeconds(value)).toBe(result);
});
test('successful verification commits only proof and the configuration snapshot', async () => {
  const s = setup();
  expect(await s.verify('91', messageId)).toEqual({ code: 'confirmed', messageId });
  expect(s.deliveries.complete).toHaveBeenCalledWith({ messageId, verificationConfig: config });
  expect(s.repository.finish).toHaveBeenCalledWith('id', 'confirmed', 60);
  expect(s.logger.info).toHaveBeenCalledWith(expect.any(String), { classificationId: '91', code: 'confirmed' });
});
test.each(['receipt_missing', 'not_eligible', 'configuration_changed', 'cooldown', 'confirmed'])('no provider work for %s', async code => {
  const s = setup();
  s.repository.admit.mockResolvedValue({ code });
  expect(await s.verify('91', messageId)).toEqual({ code });
  expect(s.read).not.toHaveBeenCalled();
  expect(s.repository.finish).not.toHaveBeenCalled();
});
test.each(['access_denied', 'message_unavailable', 'proof_mismatch', 'bot_changed', 'provider_unavailable', 'timed_out', 'cancelled'])('negative %s never writes delivery proof', async code => {
  const s = setup(); s.read.mockResolvedValue({ code });
  expect(await s.verify('91', messageId)).toEqual({ code });
  expect(s.deliveries.complete).not.toHaveBeenCalled();
});
test('persists rate limits, including unknown limits', async () => {
  const s = setup();
  for (const retryAfterSeconds of [130, null]) {
    s.read.mockResolvedValue({ code: 'rate_limited', retryAfterSeconds });
    await s.verify('91', messageId);
    expect(s.repository.finish).toHaveBeenLastCalledWith('id', 'rate_limited', retryAfterSeconds);
  }
});
test('rejects overlapping work without a queue and releases on errors', async () => {
  const s = setup(); const deferred = Promise.withResolvers(); s.read.mockReturnValue(deferred.promise);
  const first = s.verify('91', messageId);
  expect(await s.verify('92', messageId)).toEqual({ code: 'busy' });
  deferred.reject(new Error('private response'));
  expect(await first).toEqual({ code: 'verification_unavailable' });
  s.repository.admit.mockRejectedValue(new Error('private database'));
  expect(await s.verify('91', messageId)).toEqual({ code: 'verification_unavailable' });
  expect(s.repository.admit).toHaveBeenCalledTimes(2);
});
test('cancellation before admission or after provider response never completes', async () => {
  const s = setup(); const controller = new AbortController(); controller.abort();
  expect(await s.verify('91', messageId, controller.signal)).toEqual({ code: 'cancelled' });
  expect(s.repository.admit).not.toHaveBeenCalled();
  const after = new AbortController();
  s.read.mockImplementation(async () => { after.abort(); return { code: 'verified', proof: { messageId } }; });
  expect(await s.verify('91', messageId, after.signal)).toEqual({ code: 'cancelled' });
  expect(s.deliveries.complete).not.toHaveBeenCalled();
});
test('completion and audit failure never report uncommitted success', async () => {
  const s = setup();
  s.deliveries.complete.mockResolvedValue(false);
  expect(await s.verify('91', messageId)).toEqual({ code: 'configuration_changed' });
  s.deliveries.complete.mockRejectedValue(new Error('private database'));
  expect(await s.verify('91', messageId)).toEqual({ code: 'verification_unavailable' });
  s.repository.finish.mockRejectedValue(new Error('private audit'));
  expect(await s.verify('91', messageId)).toEqual({ code: 'verification_unavailable' });
});

const verifyToken = jest.fn();
jest.unstable_mockModule('../services/auth.mjs', () => ({ verifyToken }));
const { authenticateToken, requireAdmin } = await import('../middleware/auth.mjs');
function appFor(query) {
  const db = { withTransaction: fn => fn({ query }) };
  const router = express.Router();
  const noop = (_req, res) => res.sendStatus(204);
  registerNotificationRoutes(router, { requireAdmin, discordHandlers: {
    getDeliveries: noop, verifyDelivery: createDiscordDeliveryVerificationHandler(db, { info: jest.fn() }),
    getConfig: noop, updateConfig: noop, testConnection: noop, getServers: noop,
    getChannels: noop, getMentionTargets: noop, getChannelDetails: noop,
  } });
  return express().use(express.json()).use('/api/settings', authenticateToken, router);
}
test('actual route requires login and admin before strict validation and database access', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [] }); const app = appFor(query);
  const post = () => request(app).post('/api/settings/discord/deliveries/91/verify');
  expect((await post().send({ messageId })).status).toBe(401);
  verifyToken.mockResolvedValue({ role: 'user' });
  expect((await post().set('Authorization', 'Bearer fixture').send({ messageId })).status).toBe(403);
  verifyToken.mockResolvedValue({ role: 'admin' });
  expect((await post().set('Authorization', 'Bearer fixture').send({ messageId, channelId: 'other' })).status).toBe(400);
  expect(query).not.toHaveBeenCalled();
  const result = await post().set('Authorization', 'Bearer fixture').send({ messageId });
  expect(result.status).toBe(409);
  expect(result.headers['cache-control']).toBe('no-store');
  expect(result.body).toEqual({ code: 'receipt_missing' });
});
