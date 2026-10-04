/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createDiscordDeliveryRepository } from '../../services/discordDeliveryRepository.mjs';
import { createDiscordDeliveryService } from '../../services/discordDeliveryService.mjs';
import { createDiscordProviderCooldown, DiscordDeliveryDeferredError } from '../../services/discordProviderCooldown.mjs';
import { createDiscordDeliveryVerificationReader } from '../../services/discordDeliveryVerificationReader.mjs';
import { createDiscordDeliveryReviewRepository } from '../../services/discordDeliveryReviewRepository.mjs';
import { createDiscordProviderGate } from '../../services/discordProviderGate.mjs';
import { createDiscordDeliveryWriter } from '../../services/discordDeliveryWriter.mjs';

const database = createIntegrationDatabaseModuleMock();
const repository = createDiscordDeliveryRepository(database);
const cooldown = createDiscordProviderCooldown(database);
const bot = '111111111111111111'; const channelId = '222222222222222222'; const messageId = '333333333333333333';
let input;
const send = jest.fn();
const service = () => createDiscordDeliveryService(createDiscordDeliveryRepository(database), send);
const receipt = async () => (await getPool().query('SELECT * FROM discord_notification_deliveries WHERE classification_id = $1', [input.classificationId])).rows[0];
const expire = () => getPool().query("UPDATE discord_provider_cooldown SET next_allowed_at = clock_timestamp() - interval '1 second'");
beforeEach(async () => {
  await getPool().query('DELETE FROM discord_provider_cooldown');
  await getPool().query('DELETE FROM notification_config');
  await getPool().query('DELETE FROM classification_history');
  const { rows: [config] } = await getPool().query(`INSERT INTO notification_config
    (type, enabled, bot_token, channel_id) VALUES ('discord', true, 'synthetic-token', $1) RETURNING *`, [channelId]);
  const { rows: [history] } = await getPool().query(`INSERT INTO classification_history
    (title, media_type, status) VALUES ('Fixture', 'movie', 'awaiting_decision') RETURNING id`);
  input = { classificationId: history.id, kind: 'pending', config, channelId,
    client: { user: { id: bot }, token: 'synthetic-token' }, payload: { content: 'fixture' }, warnFn: jest.fn() };
  send.mockReset().mockImplementation(async () => {
    const waiting = await cooldown.defer(90);
    throw new DiscordDeliveryDeferredError(waiting.retryAfterSeconds);
  });
});

test('exhausted success persists across independent gates and restart without losing its body', async () => {
  const first = createDiscordProviderGate({ cooldown });
  const response = await first.run(async () => new Response('proof', { headers: {
    'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '180.1',
  } }), 'unused', {});
  expect(await response.text()).toBe('proof');
  const restarted = createDiscordProviderGate({ cooldown: createDiscordProviderCooldown(database) });
  const request = jest.fn();
  await expect(restarted.run(request, 'unused', {})).rejects.toMatchObject({ retryAfterSeconds: 181 });
  expect(request).not.toHaveBeenCalled();
  await expire(); request.mockResolvedValue(new Response('next'));
  expect(await (await restarted.run(request, 'unused', {})).text()).toBe('next');
});

test('concurrent successful observations cannot shorten persisted deadlines', async () => {
  const run = seconds => createDiscordProviderGate({ cooldown }).run(async () => new Response('ok', {
    headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': String(seconds) },
  }), 'unused', {});
  // Gate admission is not a quota reservation: explicitly let both HTTP responses overlap.
  const barrier = Promise.withResolvers(); let arrived = 0;
  const simultaneous = createDiscordProviderGate({ cooldown: { defer: cooldown.defer, read: async () => {
    if (++arrived === 2) barrier.resolve(); await barrier.promise; return null;
  } } });
  await Promise.all([90, 240].map(seconds => simultaneous.run(async () => new Response('ok', {
    headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': String(seconds) },
  }), 'unused', {})));
  expect((await cooldown.read()).retryAfterSeconds).toBe(240);
  await expect(run(60)).rejects.toBeInstanceOf(DiscordDeliveryDeferredError);
});

test('cooldown SQL failure after provider success does not discard the durable delivery proof', async () => {
  const warn = jest.fn();
  input.client.options = { allowedMentions: { parse: [] }, jsonTransformer: value => value };
  const gate = createDiscordProviderGate({ warn, cooldown: { read: cooldown.read,
    defer: () => database.withTransaction(client => client.query('SELECT 1 / 0')),
  } });
  const request = jest.fn(async () => new Response(JSON.stringify({
    id: messageId, channel_id: channelId, author: { id: bot, bot: true },
  }), { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '60' } }));
  const delivery = createDiscordDeliveryService(repository, createDiscordDeliveryWriter({ gate, request }));
  expect(await delivery.send({ ...input, channel: { client: input.client } })).toMatchObject({ sent: true });
  expect(await receipt()).toMatchObject({ state: 'delivered', message_id: messageId });
  await expect(gate.run(request, 'unused', {})).rejects.toMatchObject({ code: 'DISCORD_COOLDOWN_UNAVAILABLE' });
  expect(request).toHaveBeenCalledTimes(1); expect(warn).toHaveBeenCalledTimes(1);
});

test('fresh reads do not create cooldown state; known delay blocks a new receipt before POST', async () => {
  expect(await cooldown.read()).toBeNull();
  expect((await getPool().query('SELECT count(*) FROM discord_provider_cooldown')).rows[0].count).toBe(0);
  await cooldown.defer(120);
  expect(await service().send(input)).toMatchObject({ reason: 'delivery_deferred', retryAfterSeconds: 120 });
  expect(await receipt()).toBeUndefined(); expect(send).not.toHaveBeenCalled();
});
test('restart preserves provider delay and deferred receipt; elapsed fixture clock permits one new admitted attempt', async () => {
  expect(await service().send(input)).toMatchObject({ reason: 'delivery_deferred' });
  const original = await receipt();
  expect(original).toMatchObject({ state: 'deferred', attempt_count: 1, failure_code: 'provider_rate_limited' });
  expect(original.config_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(await service().send(input)).toMatchObject({ reason: 'delivery_deferred' });
  expect(send).toHaveBeenCalledTimes(1);
  await expire(); send.mockResolvedValue({ id: messageId });
  const results = await Promise.all(Array.from({ length: 8 }, () => service().send(input)));
  expect(results.filter(result => result.sent)).toHaveLength(1);
  expect(send).toHaveBeenCalledTimes(2);
  expect(await receipt()).toMatchObject({ nonce: original.nonce, attempt_count: 2, state: 'delivered', message_id: messageId });
});
test('three admitted 429 attempts exhaust the durable budget without resetting it', async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await expire(); expect(await service().send(input)).toMatchObject({ reason: 'delivery_deferred' });
    expect((await receipt()).attempt_count).toBe(attempt);
  }
  await expire();
  expect(await service().send(input)).toMatchObject({ reason: 'delivery_attempts_exhausted' });
  expect(send).toHaveBeenCalledTimes(3);
});
test.each(['disabled', 'token', 'channel', 'revision', 'kind', 'decision', 'clarification', 'desired', 'bot', 'legacy'])('%s cannot revive a deferred intent', async change => {
  await service().send(input); await expire();
  if (change === 'disabled') await getPool().query('UPDATE notification_config SET enabled = false');
  if (change === 'token') {
    await getPool().query("UPDATE notification_config SET bot_token = 'rotated'");
    input.client.token = 'rotated'; input.config.bot_token = 'rotated';
  }
  if (change === 'channel') {
    await getPool().query('UPDATE notification_config SET channel_id = $1', [messageId]);
    input.channelId = messageId; input.config.channel_id = messageId;
  }
  if (change === 'revision') {
    const { rows: [updated] } = await getPool().query("UPDATE notification_config SET updated_at = updated_at + interval '1 second' RETURNING *");
    input.config = updated;
  }
  if (change === 'kind') input.kind = 'confidence';
  if (change === 'decision') await getPool().query("UPDATE classification_history SET status = 'verified'");
  if (change === 'clarification') await getPool().query("UPDATE classification_history SET clarification_status = 'resolved'");
  if (change === 'desired') input.clarificationStatus = 'resolved';
  if (change === 'bot') input.client.user.id = messageId;
  if (change === 'legacy') await getPool().query('UPDATE discord_notification_deliveries SET config_fingerprint = NULL');
  expect((await service().send(input)).sent).toBe(false);
  expect(send).toHaveBeenCalledTimes(1); expect((await receipt()).attempt_count).toBe(1);
});
test('uncertain attempt after a known deferral is never retried, even after cooldown expires', async () => {
  await service().send(input); await expire();
  send.mockRejectedValue(new Error('response lost'));
  expect(await service().send(input)).toMatchObject({ reason: 'delivery_unconfirmed' });
  expect(await service().send(input)).toMatchObject({ reason: 'delivery_unconfirmed' });
  expect(send).toHaveBeenCalledTimes(2);
});
test('lost deferred persistence acknowledgement cannot cause an immediate resend', async () => {
  const failing = { ...repository, defer: async (...args) => { await repository.defer(...args); throw new Error('lost commit'); } };
  expect(await createDiscordDeliveryService(failing, send).send(input)).toMatchObject({ reason: 'delivery_unconfirmed' });
  expect(await service().send(input)).toMatchObject({ reason: 'delivery_deferred' });
  expect(send).toHaveBeenCalledTimes(1);
});
test('late deferral cannot downgrade confirmed evidence or overwrite a newer admission', async () => {
  const first = await repository.claim(input);
  await repository.defer(first.nonce, first.attempt);
  const second = await repository.claim(input);
  expect(second.attempt).toBe(2);
  await repository.defer(first.nonce, first.attempt);
  expect((await receipt()).state).toBe('sending');
  await repository.complete({ nonce: second.nonce, botUserId: bot, channelId, messageId });
  expect(await repository.defer(second.nonce, second.attempt)).toMatchObject({ reason: 'already_notified', messageId });
  expect((await receipt()).failure_code).toBeNull();
});
test('concurrent provider observations only lengthen the shared cooldown; invalid delay remains paused', async () => {
  await Promise.all([60, 130, 90].map(seconds => cooldown.defer(seconds)));
  expect((await createDiscordProviderCooldown(database).read()).retryAfterSeconds).toBe(130);
  await cooldown.defer('invalid'); await cooldown.defer(60);
  expect(await cooldown.read()).toEqual({ code: 'rate_limited', retryAfterSeconds: null });
  expect((await getPool().query('SELECT count(*) FROM discord_provider_cooldown')).rows[0].count).toBe(1);
});
test('verification shares durable send cooldown and does not make an identity or message request', async () => {
  await service().send(input);
  const request = jest.fn();
  const read = createDiscordDeliveryVerificationReader({ request, cooldown: createDiscordProviderCooldown(database) });
  expect(await read({ receipt: await receipt(), config: input.config, messageId })).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 90 });
  expect(request).not.toHaveBeenCalled();
});
test('verification 429 persists shared cooldown that blocks new sends', async () => {
  const request = jest.fn().mockResolvedValue(new Response('{"retry_after":125.25}', { status: 429 }));
  const read = createDiscordDeliveryVerificationReader({ request, cooldown });
  expect(await read({ receipt: { bot_user_id: bot }, config: input.config, messageId })).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 126 });
  expect(await service().send(input)).toMatchObject({ reason: 'delivery_deferred' });
  expect(send).not.toHaveBeenCalled(); expect(request).toHaveBeenCalledTimes(1);
});
test('review exposes deferred status without credentials, fingerprint or unsafe verification action', async () => {
  await service().send(input);
  const { items: [row] } = await createDiscordDeliveryReviewRepository(database).list('9223372036854775807');
  expect(row).toMatchObject({ state: 'deferred', canVerify: false });
  expect(JSON.stringify(row)).not.toMatch(/synthetic|fingerprint|bot_token/);
});
