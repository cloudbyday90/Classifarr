/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createDiscordDeliveryRepository } from '../../services/discordDeliveryRepository.mjs';
import { createDiscordDeliveryService } from '../../services/discordDeliveryService.mjs';
import { formatDeliveryMarker } from '../../services/discordDeliveryMarker.mjs';

const botId = '111111111111111111';
const channelId = '222222222222222222';
const messageId = '333333333333333333';
const database = createIntegrationDatabaseModuleMock();
const repository = createDiscordDeliveryRepository(database);
let input;
let service;

beforeEach(async () => {
  await getPool().query('DELETE FROM notification_config');
  await getPool().query('DELETE FROM classification_history');
  const { rows: [config] } = await getPool().query(`INSERT INTO notification_config
    (type, enabled, bot_token, channel_id) VALUES ('discord', true, 'synthetic-token', $1) RETURNING *`, [channelId]);
  const { rows: [history] } = await getPool().query(`INSERT INTO classification_history
    (title, media_type, status) VALUES ('Fixture', 'movie', 'awaiting_decision') RETURNING id`);
  input = { classificationId: history.id, kind: 'pending', config, channelId,
    client: { user: { id: botId }, token: 'synthetic-token' },
    channel: { send: jest.fn().mockResolvedValue({ id: messageId }) },
    payload: { content: 'fixture' }, warnFn: jest.fn() };
  service = createDiscordDeliveryService(repository);
});

async function receipt() {
  return (await getPool().query('SELECT * FROM discord_notification_deliveries WHERE classification_id = $1',
    [input.classificationId])).rows[0];
}
function event(nonce, overrides = {}) {
  return { id: messageId, nonce, channelId, author: { id: botId }, ...overrides };
}

function markedEvent(saved, overrides = {}) {
  return event(null, { type: 0, author: { id: botId, bot: true },
    embeds: [{ footer: { text: formatDeliveryMarker(saved.classification_id, saved.nonce) } }], ...overrides });
}

test('restart can confirm a persisted marker without nonce, replay, or a current enabled configuration', async () => {
  input.channel.send.mockRejectedValue(new Error('reply lost'));
  await service.send(input);
  const saved = await receipt();
  await getPool().query("UPDATE notification_config SET enabled = false, channel_id = '444444444444444444', bot_token = 'rotated'");
  const restarted = createDiscordDeliveryService(createDiscordDeliveryRepository(database));
  expect(await restarted.observe(markedEvent(saved), input.client)).toBe(true);
  expect(await restarted.observe(markedEvent(saved), input.client)).toBe(true);
  expect((await receipt()).message_id).toBe(messageId);
  expect(await restarted.send(input)).toMatchObject({ reason: 'already_notified' });
  expect(input.channel.send).toHaveBeenCalledTimes(1);
});

test('stored scope and correlation version reject unrelated markers, even from an own-bot event', async () => {
  await repository.claim(input);
  const saved = await receipt();
  expect(await service.observe(markedEvent({ ...saved, classification_id: String(Number(saved.classification_id) + 1) }), input.client)).toBe(false);
  expect(await service.observe(markedEvent({ ...saved, nonce: 'cf_abcdefghijklmnopqrstuv' }), input.client)).toBe(false);
  expect(await service.observe(markedEvent(saved, { channelId: '444444444444444444' }), input.client)).toBe(false);
  expect(await service.observe(markedEvent(saved, { author: { id: '444444444444444444', bot: true } }), { user: { id: '444444444444444444' } })).toBe(false);
  expect(await repository.complete({ nonce: saved.nonce, botUserId: botId, channelId, messageId,
    classificationId: String(saved.classification_id), correlationVersion: 2 })).toBe(false);
  expect((await receipt()).state).toBe('sending');
  expect(await service.observe(markedEvent(saved), input.client)).toBe(true);
  expect(await service.observe(markedEvent(saved, { id: '444444444444444444' }), input.client)).toBe(false);
  expect((await receipt()).message_id).toBe(messageId);
});

test('legacy NULL version survives migration replay and cannot be upgraded by a matching footer', async () => {
  await getPool().query(`INSERT INTO discord_notification_deliveries
    (classification_id, nonce, bot_user_id, channel_id, notification_kind)
    VALUES ($1, 'cf_abcdefghijklmnopqrstuv', $2, $3, 'pending')`, [input.classificationId, botId, channelId]);
  const migration = await readFile(new URL('../../../../database/migrations/20261004_160000_discord_delivery_correlation.sql', import.meta.url), 'utf8');
  await getPool().query(migration);
  await getPool().query(migration);
  const legacy = await receipt();
  expect(legacy.correlation_version).toBeNull();
  expect(await service.observe(markedEvent(legacy), input.client)).toBe(false);
  expect(await service.send(input)).toMatchObject({ reason: 'delivery_unconfirmed' });
  expect(input.channel.send).not.toHaveBeenCalled();
  // Live nonce evidence remains a supported legacy completion path.
  expect(await service.observe(event(legacy.nonce), input.client)).toBe(true);
});

test('marker completion racing another message preserves one receipt and the newer decision', async () => {
  await repository.claim(input);
  const saved = await receipt();
  await getPool().query("UPDATE classification_history SET status = 'verified', clarification_status = 'resolved' WHERE id = $1", [input.classificationId]);
  const results = await Promise.all([
    service.observe(markedEvent(saved), input.client),
    createDiscordDeliveryService(repository).observe(markedEvent(saved, { id: '444444444444444444' }), input.client),
  ]);
  expect(results.sort()).toEqual([false, true]);
  const { rows: [history] } = await getPool().query('SELECT status, clarification_status, discord_message_id FROM classification_history WHERE id = $1', [input.classificationId]);
  expect(history).toMatchObject({ status: 'verified', clarification_status: 'resolved', discord_message_id: (await receipt()).message_id });
  expect(input.channel.send).not.toHaveBeenCalled();
});

test('competing instances and presentation formats share one durable delivery', async () => {
  const results = await Promise.all(Array.from({ length: 12 }, (_, index) =>
    createDiscordDeliveryService(repository).send({ ...input, kind: index % 2 ? 'confidence' : 'pending' })));
  expect(results.filter(result => result.sent)).toHaveLength(1);
  expect(input.channel.send).toHaveBeenCalledTimes(1);
  const saved = await receipt();
  expect(saved.state).toBe('delivered');
  expect(saved.correlation_version).toBe(1);
  expect(input.channel.send).toHaveBeenCalledWith({ content: 'fixture', nonce: saved.nonce, enforceNonce: true,
    embeds: [{ footer: { text: `Classifarr receipt v1:${input.classificationId}:${saved.nonce}` } }] });
  const { rows: [history] } = await getPool().query('SELECT discord_message_id, metadata FROM classification_history WHERE id = $1', [input.classificationId]);
  expect(history).toEqual({ discord_message_id: messageId, metadata: { discord_message_id: messageId } });
});

test.each(['discord_message_id', 'metadata'])('legacy %s message evidence prevents a historical resend', async column => {
  if (column === 'metadata') {
    await getPool().query("UPDATE classification_history SET metadata = jsonb_build_object('discord_message_id', $1::text) WHERE id = $2", [messageId, input.classificationId]);
  } else {
    await getPool().query('UPDATE classification_history SET discord_message_id = $1 WHERE id = $2', [messageId, input.classificationId]);
  }
  expect(await service.send(input)).toMatchObject({ reason: 'already_notified' });
  expect(input.channel.send).not.toHaveBeenCalled();
  expect(await receipt()).toBeUndefined();
});

test.each(['disabled', 'token', 'channel', 'mention', 'flag', 'missing'])('configuration %s blocks stale admission', async change => {
  if (change === 'disabled') await getPool().query('UPDATE notification_config SET enabled = false');
  if (change === 'token') await getPool().query("UPDATE notification_config SET bot_token = 'rotated'");
  if (change === 'channel') await getPool().query("UPDATE notification_config SET channel_id = '444444444444444444'");
  if (change === 'mention') await getPool().query('UPDATE notification_config SET pending_mention_here = true');
  if (change === 'flag') await getPool().query('UPDATE notification_config SET notify_on_pending_items = false');
  if (change === 'missing') await getPool().query('DELETE FROM notification_config');
  expect(await service.send(input)).toMatchObject({ reason: 'configuration_changed' });
  expect(input.channel.send).not.toHaveBeenCalled();
  expect(await receipt()).toBeUndefined();
});

test('a lost response remains held across restart, elapsed time and destination changes', async () => {
  input.channel.send.mockRejectedValue(new Error('secret-provider-body'));
  expect(await service.send(input)).toMatchObject({ reason: 'delivery_unconfirmed' });
  await getPool().query("UPDATE discord_notification_deliveries SET updated_at = now() - interval '1 year'");
  input.channelId = '444444444444444444';
  expect(await createDiscordDeliveryService(repository).send(input)).toMatchObject({ reason: 'delivery_unconfirmed' });
  expect(input.channel.send).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(input.warnFn.mock.calls)).not.toContain('secret-provider-body');
  expect((await receipt()).failure_code).toBe('send_unconfirmed');
});

test('a lost claim commit acknowledgement never permits a send', async () => {
  const uncertainDb = { ...database, withTransaction: async fn => {
    await database.withTransaction(fn);
    throw new Error('lost acknowledgement');
  } };
  expect(await createDiscordDeliveryService(createDiscordDeliveryRepository(uncertainDb)).send(input))
    .toMatchObject({ reason: 'delivery_unconfirmed' });
  expect((await receipt()).state).toBe('sending');
  await service.send(input);
  expect(input.channel.send).not.toHaveBeenCalled();
});

test('completion retries only the database after a lost commit acknowledgement', async () => {
  const complete = jest.fn(async proof => {
    const result = await repository.complete(proof);
    if (complete.mock.calls.length === 1) throw new Error('lost acknowledgement');
    return result;
  });
  expect(await createDiscordDeliveryService({ ...repository, complete }).send(input)).toEqual({ sent: true, messageId });
  expect(complete).toHaveBeenCalledTimes(2);
  expect(input.channel.send).toHaveBeenCalledTimes(1);
});

test('a later Gateway event repairs failed completion without resending', async () => {
  const complete = jest.fn().mockRejectedValue(new Error('database unavailable'));
  expect(await createDiscordDeliveryService({ ...repository, complete }).send(input))
    .toMatchObject({ reason: 'delivery_unconfirmed' });
  const saved = await receipt();
  expect(complete).toHaveBeenCalledTimes(2);
  expect(await service.observe(event(saved.nonce), input.client, input.warnFn)).toBe(true);
  expect((await receipt()).state).toBe('delivered');
  await service.send(input);
  expect(input.channel.send).toHaveBeenCalledTimes(1);
});

test('Gateway confirmation wins a race with the HTTP failure write', async () => {
  input.channel.send.mockImplementation(async payload => {
    await service.observe(event(payload.nonce), input.client, input.warnFn);
    throw new Error('lost response');
  });
  expect(await service.send(input)).toMatchObject({ reason: 'already_notified', messageId });
  expect((await receipt()).failure_code).toBeNull();
  expect(input.warnFn).not.toHaveBeenCalled();
});

test('wrong author, channel, nonce and conflicting message IDs cannot overwrite a receipt', async () => {
  const claim = await repository.claim(input);
  expect(await service.observe(event(claim.nonce, { author: { id: '444444444444444444' } }), input.client)).toBe(false);
  expect(await service.observe(event(claim.nonce, { channelId: '444444444444444444' }), input.client)).toBe(false);
  expect(await service.observe(event('cf_abcdefghijklmnopqrstuv'), input.client)).toBe(false);
  expect(await service.observe(event(claim.nonce), input.client)).toBe(true);
  expect(await service.observe(event(claim.nonce, { id: '444444444444444444' }), input.client)).toBe(false);
  expect((await receipt()).message_id).toBe(messageId);
});

test('late completion preserves a newer decision and a conflicting legacy message projection', async () => {
  input.clarificationStatus = 'awaiting_clarification';
  const claim = await repository.claim(input);
  await getPool().query("UPDATE classification_history SET clarification_status = 'resolved', discord_message_id = '444444444444444444' WHERE id = $1", [input.classificationId]);
  await service.observe(event(claim.nonce), input.client);
  const { rows: [history] } = await getPool().query('SELECT clarification_status, discord_message_id FROM classification_history WHERE id = $1', [input.classificationId]);
  expect(history).toEqual({ clarification_status: 'resolved', discord_message_id: '444444444444444444' });
  expect((await receipt()).state).toBe('delivered');
});

test('normal clarification completion is conditional on the admitted decision', async () => {
  input.kind = 'confidence';
  input.clarificationStatus = 'awaiting_clarification';
  await service.send(input);
  const { rows: [history] } = await getPool().query('SELECT clarification_status FROM classification_history WHERE id = $1', [input.classificationId]);
  expect(history.clarification_status).toBe('awaiting_clarification');
});

test('migration replay preserves receipts and deleting history cascades', async () => {
  await service.send(input);
  const migration = await readFile(new URL('../../../../database/migrations/20261004_140000_discord_notification_deliveries.sql', import.meta.url), 'utf8');
  await getPool().query(migration);
  expect((await receipt()).state).toBe('delivered');
  await getPool().query('DELETE FROM classification_history WHERE id = $1', [input.classificationId]);
  expect(await receipt()).toBeUndefined();
  expect(await service.send(input)).toMatchObject({ reason: 'classification_missing' });
});

test('permanent refusal is recorded without a retry', async () => {
  input.channel.send.mockRejectedValue(Object.assign(new Error('private'), { status: 403 }));
  expect(await service.send(input)).toMatchObject({ reason: 'delivery_rejected' });
  expect(await service.send(input)).toMatchObject({ reason: 'delivery_rejected' });
  expect(input.channel.send).toHaveBeenCalledTimes(1);
});

test.each(['corrected', 'verified', 'reclassified', 'failed'])('a %s decision cannot receive a new pending alert', async status => {
  await getPool().query('UPDATE classification_history SET status = $1 WHERE id = $2', [status, input.classificationId]);
  expect(await service.send(input)).toMatchObject({ reason: 'classification_changed' });
  expect(input.channel.send).not.toHaveBeenCalled();
});

test('disabling during an admitted send does not discard positive delivery evidence', async () => {
  input.channel.send.mockImplementation(async () => {
    // A conflicting lock here would expose an accidentally open HTTP transaction.
    await database.withTransaction(async client => {
      await client.query("SET LOCAL statement_timeout = '1s'");
      await client.query('UPDATE classification_history SET clarification_status = $1 WHERE id = $2', ['resolved', input.classificationId]);
      await client.query('UPDATE notification_config SET enabled = false');
    });
    return { id: messageId };
  });
  input.clarificationStatus = 'awaiting_clarification';
  expect(await service.send(input)).toEqual({ sent: true, messageId });
  const { rows: [history] } = await getPool().query('SELECT clarification_status FROM classification_history WHERE id = $1', [input.classificationId]);
  expect(history.clarification_status).toBe('resolved');
});

test('completion failure rolls back receipt state and can be repaired later', async () => {
  const claim = await repository.claim(input);
  const failedDb = { ...database, withTransaction: fn => database.withTransaction(client => fn({
    query: (text, values) => {
      if (text.startsWith('UPDATE classification_history SET')) throw new Error('projection unavailable');
      return client.query(text, values);
    },
  })) };
  const proof = { nonce: claim.nonce, botUserId: botId, channelId, messageId };
  await expect(createDiscordDeliveryRepository(failedDb).complete(proof)).rejects.toThrow('projection unavailable');
  expect((await receipt()).state).toBe('sending');
  expect(await repository.complete(proof)).toBe(true);
});
