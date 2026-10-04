/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createDiscordDeliveryDispatcher } from '../services/discordDeliveryDispatcher.mjs';
import { validRetainedDiscordBody } from '../services/discordDeliveryBody.mjs';

function fixture(extra = {}) {
  const outbox = { cleanup: jest.fn().mockResolvedValue(0), candidates: jest.fn().mockResolvedValue([
    { classificationId: 1, nonce: 'nonce', configId: 2, kind: 'pending' },
  ]), discard: jest.fn() };
  const delivery = { send: jest.fn().mockResolvedValue({ sent: true }) };
  const getContext = jest.fn().mockResolvedValue({ client: {}, config: { id: 2, enabled: true, channel_id: 'channel' } });
  const report = jest.fn();
  return { outbox, delivery, getContext, report,
    worker: createDiscordDeliveryDispatcher({ outbox, delivery, getContext, report, ...extra }) };
}

test.each([null, { config: { enabled: false }, client: {} }, { config: { enabled: true } }])(
  'unconfigured or disabled setup only performs bounded retention cleanup (%j)', async context => {
    const f = fixture(); f.getContext.mockResolvedValue(context);
    expect(await f.worker.run()).toMatchObject({ status: 'complete', attempted: 0 });
    expect(f.outbox.cleanup).toHaveBeenCalledTimes(1);
    expect(f.outbox.candidates).not.toHaveBeenCalled(); expect(f.delivery.send).not.toHaveBeenCalled();
    expect(f.report).not.toHaveBeenCalled();
  });

test('serial dispatch is capped at four even if repository returns more', async () => {
  const f = fixture(); f.outbox.candidates.mockResolvedValue(Array.from({ length: 20 }, (_, id) => ({ configId: 2, nonce: String(id) })));
  expect(await f.worker.run()).toMatchObject({ attempted: 4, delivered: 4 });
  expect(f.delivery.send).toHaveBeenCalledTimes(4);
  expect(f.delivery.send.mock.calls[0][0]).toMatchObject({ dispatchNonce: '0', signal: expect.any(AbortSignal) });
  expect(f.report).toHaveBeenCalledWith({ attempted: 4, delivered: 4, discarded: 0 });
});

test.each(['configuration_changed', 'classification_changed', 'classification_missing', 'already_notified',
  'delivery_attempts_exhausted', 'delivery_not_retained', 'delivery_rejected'])('%s discards payload only', async reason => {
  const f = fixture(); f.delivery.send.mockResolvedValue({ sent: false, reason });
  expect(await f.worker.run()).toMatchObject({ discarded: 1 });
  expect(f.outbox.discard).toHaveBeenCalledWith('nonce');
});

test('another in-flight sender is not proof to discard its eventual deferred payload', async () => {
  const f = fixture(); f.delivery.send.mockResolvedValue({ reason: 'delivery_unconfirmed' });
  await f.worker.run(); expect(f.outbox.discard).not.toHaveBeenCalled();
});

test('mismatched configuration cannot reach delivery', async () => {
  const f = fixture(); f.outbox.candidates.mockResolvedValue([{ configId: 3, nonce: 'old' }]);
  expect(await f.worker.run()).toMatchObject({ discarded: 1 });
  expect(f.delivery.send).not.toHaveBeenCalled();
});

test('rate-limit deferral stops the pass without deleting pending data', async () => {
  const f = fixture(); f.outbox.candidates.mockResolvedValue([{ configId: 2 }, { configId: 2 }]);
  f.delivery.send.mockResolvedValue({ reason: 'delivery_deferred' });
  expect(await f.worker.run()).toMatchObject({ attempted: 1 });
  expect(f.outbox.discard).not.toHaveBeenCalled();
});

test('overlap is rejected and stop cancels a running delivery without future work', async () => {
  const f = fixture(); const held = Promise.withResolvers();
  f.delivery.send.mockImplementation(async input => { held.resolve(input.signal); await new Promise(resolve => { input.signal.addEventListener('abort', resolve); }); return {}; });
  const pending = f.worker.run(); const signal = await held.promise;
  expect(await f.worker.run()).toEqual({ status: 'skipped' });
  f.worker.stop(); expect(signal.aborted).toBe(true);
  expect(await pending).toMatchObject({ status: 'cancelled' });
  expect(await f.worker.run()).toEqual({ status: 'skipped' });
});

test('deadline aborts actual delivery and exceptions expose no raw details', async () => {
  const f = fixture({ timeoutMs: 10 });
  f.delivery.send.mockImplementation(input => new Promise(resolve => { input.signal.addEventListener('abort', () => resolve({})); }));
  expect(await f.worker.run()).toMatchObject({ status: 'cancelled' });
  f.outbox.cleanup.mockRejectedValue(new Error('secret'));
  expect(await f.worker.run()).toEqual({ status: 'failed', attempted: 0, delivered: 0, discarded: 0 });
});

test('retained payload rejects malformed, wrong-scope, oversized or unsupported bodies', () => {
  const nonce = 'cf_abcdefghijklmnopqrstuv';
  const valid = { nonce, enforce_nonce: true, embeds: [{ footer: { text: `Classifarr receipt v1:1:${nonce}` } }] };
  expect(validRetainedDiscordBody(JSON.stringify(valid), 1, nonce)).toBe(true);
  for (const value of [null, '{', 'null', JSON.stringify({ ...valid, token: 'secret' }),
    JSON.stringify({ ...valid, enforce_nonce: false }), JSON.stringify({ ...valid, content: 'x'.repeat(65536) })]) {
    expect(validRetainedDiscordBody(value, 1, nonce)).toBe(false);
  }
  expect(validRetainedDiscordBody(JSON.stringify(valid), 2, nonce)).toBe(false);
});
