/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createDiscordDeliveryService } from '../services/discordDeliveryService.mjs';
import { configAllowsDelivery, isDeliveryNonce, isDiscordId } from '../services/discordDeliveryContract.mjs';

let repository;
let service;
let input;
const nonce = 'cf_abcdefghijklmnopqrstuv';
const botId = '111111111111111111';
const channelId = '222222222222222222';
const messageId = '333333333333333333';
beforeEach(() => {
  repository = { claim: jest.fn().mockResolvedValue({ admitted: true, nonce }),
    complete: jest.fn().mockResolvedValue(true),
    fail: jest.fn().mockResolvedValue({ sent: false, reason: 'delivery_unconfirmed' }) };
  service = createDiscordDeliveryService(repository);
  input = { classificationId: 1, kind: 'pending', channelId,
    client: { user: { id: botId }, token: 'fixture' }, config: {},
    channel: { send: jest.fn().mockResolvedValue({ id: messageId }) },
    payload: { content: 'fixture', nonce: 'cannot-override', enforceNonce: false }, warnFn: jest.fn() };
});

test('validates scope without querying or sending', async () => {
  for (const change of [{ classificationId: 0 }, { classificationId: '1 OR TRUE' },
    { kind: 'system' }, { channelId: 'invalid' }, { client: null }]) {
    expect(await service.send({ ...input, ...change })).toMatchObject({ reason: 'invalid_delivery_scope' });
  }
  expect(repository.claim).not.toHaveBeenCalled();
  expect(input.channel.send).not.toHaveBeenCalled();
  expect(isDiscordId(null)).toBe(false);
  expect(isDeliveryNonce('untrusted')).toBe(false);
});

test('delivery cap has no queue and frees capacity after failure', async () => {
  const held = Promise.withResolvers();
  repository.claim.mockImplementation(() => held.promise);
  const pending = Array.from({ length: 8 }, () => service.send(input));
  expect(await service.send(input)).toMatchObject({ reason: 'delivery_busy' });
  expect(repository.claim).toHaveBeenCalledTimes(8);
  held.reject(new Error('private'));
  await Promise.all(pending);
  repository.claim.mockResolvedValue({ admitted: true, nonce });
  expect(await service.send(input)).toEqual({ sent: true, messageId });
  expect(input.channel.send).toHaveBeenCalledWith({ content: 'fixture', nonce, enforceNonce: true });
});

test('Gateway cap is separate, rejects unrelated events, and frees slots', async () => {
  const held = Promise.withResolvers();
  repository.complete.mockImplementation(() => held.promise);
  const event = { id: messageId, nonce, channelId, author: { id: botId } };
  expect(await service.observe({ ...event, nonce: null }, input.client)).toBe(false);
  expect(await service.observe({ ...event, author: { id: 'someone-else' } }, input.client)).toBe(false);
  const pending = Array.from({ length: 8 }, () => service.observe(event, input.client));
  expect(await service.observe(event, input.client, input.warnFn)).toBe(false);
  expect(repository.complete).toHaveBeenCalledTimes(8);
  held.resolve(true);
  await Promise.all(pending);
  expect(await service.observe(event, input.client)).toBe(true);
  expect(input.channel.send).not.toHaveBeenCalled();
});

test.each(['DISCORD_REQUEST_TIMEOUT', 'DISCORD_REQUEST_CANCELLED', 'DISCORD_TRANSPORT_CLOSED'])('%s stays uncertain without replay', async code => {
  input.channel.send.mockRejectedValue(Object.assign(new Error('private'), { code }));
  expect(await service.send(input)).toMatchObject({ reason: 'delivery_unconfirmed' });
  expect(repository.fail).toHaveBeenCalledWith(nonce, 'send_unconfirmed');
  expect(input.channel.send).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(input.warnFn.mock.calls)).not.toContain('private');
});

test('an invalid response ID cannot be saved as evidence', async () => {
  input.channel.send.mockResolvedValue({ id: 'bad' });
  await service.send(input);
  expect(repository.complete).not.toHaveBeenCalled();
  expect(repository.fail).toHaveBeenCalledWith(nonce, 'completion_unconfirmed');
});

test('failed failure persistence is sanitized and never resends', async () => {
  input.channel.send.mockRejectedValue(new Error('provider-secret'));
  repository.fail.mockRejectedValue(new Error('db-secret'));
  expect(await service.send(input)).toMatchObject({ reason: 'delivery_unconfirmed' });
  expect(JSON.stringify(input.warnFn.mock.calls)).not.toMatch(/provider-secret|db-secret/);
  expect(input.channel.send).toHaveBeenCalledTimes(1);
});

test('saved admission requires current enabled credentials and revision', () => {
  const config = { id: 1, enabled: true, bot_token: 'Bot fixture', channel_id: channelId,
    updated_at: new Date('2026-10-04T00:00:00Z'), notify_on_pending_items: true };
  input.config = config;
  expect(configAllowsDelivery({ ...config }, input)).toBe(true);
  expect(configAllowsDelivery(null, input)).toBe(false);
  expect(configAllowsDelivery({ ...config, enabled: false }, input)).toBe(false);
  expect(configAllowsDelivery({ ...config, id: 2 }, input)).toBe(false);
  expect(configAllowsDelivery({ ...config, updated_at: new Date('2026-10-04T00:00:01Z') }, input)).toBe(false);
  expect(configAllowsDelivery({ ...config, updated_at: new Date('2026-10-04T00:00:00.001Z') }, input)).toBe(false);
  expect(configAllowsDelivery({ ...config, enable_corrections: true }, input)).toBe(false);
  expect(configAllowsDelivery(config, { ...input, kind: 'confidence' })).toBe(false);
});

test('passive confirmation bounds retries and tolerates a failed diagnostic sink', async () => {
  repository.complete.mockRejectedValue(new Error('db-secret'));
  const warnFn = jest.fn(() => { throw new Error('sink failed'); });
  expect(await service.observe({ id: messageId, nonce, channelId, author: { id: botId } }, input.client, warnFn)).toBe(false);
  expect(repository.complete).toHaveBeenCalledTimes(2);
  expect(warnFn).toHaveBeenCalledWith(expect.objectContaining({
    dedupeSignature: 'delivery_confirmation_unavailable:initial-notification',
  }));
});
