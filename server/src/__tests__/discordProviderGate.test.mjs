/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createDiscordProviderGate } from '../services/discordProviderGate.mjs';
import { DiscordDeliveryDeferredError } from '../services/discordProviderCooldown.mjs';

function fixture(options = {}) {
  const cooldown = { read: jest.fn(async () => null), defer: jest.fn(async seconds => ({ retryAfterSeconds: seconds })) };
  const warn = jest.fn();
  const request = jest.fn(async () => new Response('{"ok":true}'));
  const gate = createDiscordProviderGate({ cooldown, warn, ...options });
  return { cooldown, warn, request, gate, run: (signal = undefined) => gate.run(request, 'unused', { signal }) };
}
test('idle gate performs no work; ordinary success does not save a cooldown', async () => {
  const f = fixture(); expect(f.cooldown.read).not.toHaveBeenCalled();
  expect(await (await f.run()).json()).toEqual({ ok: true });
  expect(f.cooldown.defer).not.toHaveBeenCalled();
});
test.each(['1.5', null, 'bad'])('exhausted success preserves body and normalizes %s', async delay => {
  const f = fixture();
  f.request.mockImplementation(async () => new Response('{"id":"proof"}', { headers: {
    'x-ratelimit-remaining': '0', ...delay === null ? {} : { 'x-ratelimit-reset-after': delay },
  } }));
  expect(await (await f.run()).json()).toEqual({ id: 'proof' });
  expect(f.cooldown.defer).toHaveBeenCalledWith(delay === '1.5' ? 60 : null);
});
test('unsaved success stays successful; next call fails closed, warning is deduplicated, repair is on demand', async () => {
  const f = fixture(); f.cooldown.defer.mockRejectedValue(new Error('private database secret'));
  f.request.mockImplementation(async () => new Response('proof', { headers: {
    'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '120',
  } }));
  expect(await (await f.run()).text()).toBe('proof');
  await expect(f.run()).rejects.toMatchObject({ code: 'DISCORD_COOLDOWN_UNAVAILABLE' });
  expect(f.request).toHaveBeenCalledTimes(1); expect(f.warn).toHaveBeenCalledTimes(1);
  f.cooldown.defer.mockResolvedValue({ retryAfterSeconds: 120 });
  f.cooldown.read.mockResolvedValue({ retryAfterSeconds: 120 });
  await expect(f.run()).rejects.toBeInstanceOf(DiscordDeliveryDeferredError);
  expect(f.request).toHaveBeenCalledTimes(1);
});
test('newer observation survives an older save completing late and preserves longest delay', async () => {
  const f = fixture(); const first = Promise.withResolvers(); const second = Promise.withResolvers();
  f.cooldown.defer.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  f.request.mockImplementationOnce(async () => new Response('a', { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '120' } }))
    .mockImplementationOnce(async () => new Response('b', { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '180' } }));
  const a = f.run(); const b = f.run();
  await new Promise(resolve => { setImmediate(resolve); });
  first.resolve({ retryAfterSeconds: 120 }); await a;
  second.reject(new Error('offline')); await b;
  f.cooldown.read.mockResolvedValue({ retryAfterSeconds: 180 });
  await expect(f.run()).rejects.toBeInstanceOf(DiscordDeliveryDeferredError);
  expect(f.cooldown.defer.mock.calls.map(call => call[0])).toEqual([120, 180, 180]);
});
test('429 requires persistence before it can be called deferred; body fallback uses seconds', async () => {
  const f = fixture(); f.request.mockImplementation(async () => new Response('{"retry_after":90.5}', { status: 429 }));
  await expect(f.run()).rejects.toMatchObject({ retryAfterSeconds: 91 });
  expect(f.request).toHaveBeenCalledTimes(1);
  f.cooldown.defer.mockRejectedValue(new Error('private'));
  await expect(f.run()).rejects.toMatchObject({ code: 'DISCORD_COOLDOWN_UNAVAILABLE' });
});
test('preemptive SDK delay is saved but never sleeps', async () => {
  const f = fixture(); await expect(f.gate.defer(200)).rejects.toMatchObject({ retryAfterSeconds: 200 });
  expect(f.request).not.toHaveBeenCalled();
});
test('cancel before and during admission prevents HTTP', async () => {
  const f = fixture(); await expect(f.run(AbortSignal.abort())).rejects.toThrow();
  expect(f.cooldown.read).not.toHaveBeenCalled();
  const controller = new AbortController(); f.cooldown.read.mockImplementation(async () => { controller.abort(); return null; });
  await expect(f.run(controller.signal)).rejects.toThrow(); expect(f.request).not.toHaveBeenCalled();
});
test('database read failure is sanitized and closed', async () => {
  const f = fixture(); f.cooldown.read.mockRejectedValue(new Error('secret'));
  await expect(f.run()).rejects.toMatchObject({ message: 'Discord cooldown unavailable' });
  expect(f.request).not.toHaveBeenCalled();
});
test('capacity includes admission and is released after failure', async () => {
  const f = fixture({ maxConcurrent: 1 }); const read = Promise.withResolvers();
  f.cooldown.read.mockImplementationOnce(() => read.promise);
  const pending = f.run(); await expect(f.run()).rejects.toMatchObject({ code: 'DISCORD_REST_BUSY' });
  read.reject(new Error('offline')); await expect(pending).rejects.toThrow();
  await f.run(); expect(f.request).toHaveBeenCalledTimes(1);
});
test('exhausted headers on a permanent refusal retain both the limit and original status', async () => {
  const f = fixture(); f.request.mockImplementation(async () => new Response('refused', {
    status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '120' },
  }));
  expect((await f.run()).status).toBe(403); expect(f.cooldown.defer).toHaveBeenCalledWith(120);
  f.cooldown.defer.mockRejectedValue(new Error('offline'));
  expect((await f.run()).status).toBe(403); expect(f.warn).toHaveBeenCalledTimes(1);
});
test('invalid capacity rejected', () => {
  expect(() => fixture({ maxConcurrent: 0 })).toThrow(TypeError);
});
