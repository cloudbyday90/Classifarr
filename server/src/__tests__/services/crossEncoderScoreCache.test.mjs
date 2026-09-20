/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { setImmediate } from 'node:timers/promises';
import { createCrossEncoderScoreCache } from '../../services/crossEncoderScoreCache.mjs';
const scope = Object.fromEntries(['model', 'source', 'representation', 'access'].map((name, index) => [name, String(index).repeat(64)]));
const input = { query: 'private query', texts: ['private example'] };
function fixture(options = {}) {
  let time = 100;
  const client = { score: jest.fn(async () => ({ scores: [2] })) };
  return { client, tick: value => { time += value; }, cache: createCrossEncoderScoreCache({ client, now: () => time, freshMs: 10, staleMs: 100, cooldownMs: 20, ...options }) };
}
test('fresh copies, single flight, stale refresh, outage cooldown and automatic next-read recovery', async () => {
  const { client, cache, tick } = fixture();
  const [a, b] = await Promise.all([cache.get(scope, input), cache.get(scope, input)]);
  a.scores[0] = 999; expect(b.scores).toEqual([2]); expect(client.score).toHaveBeenCalledTimes(1);
  expect(await cache.get(scope, input)).toEqual({ status: 'fresh', scores: [2] });
  client.score.mockRejectedValueOnce(new Error('private outage')); tick(11);
  expect(await cache.get(scope, input)).toEqual({ status: 'stale', scores: [2] }); await setImmediate();
  await cache.get(scope, input); expect(client.score).toHaveBeenCalledTimes(2);
  tick(21); expect((await cache.get(scope, input)).status).toBe('stale'); await setImmediate();
  expect((await cache.get(scope, input)).status).toBe('fresh'); expect(client.score).toHaveBeenCalledTimes(3);
  await cache.dispose();
});
test.each(['model', 'source', 'representation', 'access'])('%s revision never reuses cached scores', async field => {
  const { client, cache } = fixture(); await cache.get(scope, input);
  await cache.get({ ...scope, [field]: 'f'.repeat(64) }, input); expect(client.score).toHaveBeenCalledTimes(2); await cache.dispose();
});
test('expired values, invalid output and identity failures are unavailable, never eternal stale', async () => {
  const { client, cache, tick } = fixture(); await cache.get(scope, input); tick(101);
  client.score.mockRejectedValueOnce(new Error('outage'));
  expect(await cache.get(scope, input)).toEqual({ status: 'unavailable', scores: [] });
  tick(21); client.score.mockResolvedValueOnce({ scores: [NaN] });
  expect((await cache.get(scope, input)).status).toBe('unavailable');
  client.score.mockRejectedValueOnce(new Error('cross_encoder_identity_invalid'));
  expect((await cache.get(scope, input)).status).toBe('unavailable');
  expect((await cache.get(scope, input)).status).toBe('fresh'); await cache.dispose();
});
test('caller cancellation does not cancel a shared computation; invalidation fences late output', async () => {
  const { cache, client } = fixture(); let finish;
  client.score.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const first = cache.get(scope, input, { signal: controller.signal }), shared = cache.get(scope, input);
  await setImmediate(); controller.abort(); await expect(first).rejects.toThrow();
  finish({ scores: [4] }); expect((await shared).scores).toEqual([4]);
  cache.invalidate();
  client.score.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const late = cache.get(scope, input); await setImmediate(); cache.invalidate(); finish({ scores: [9] });
  expect((await late).status).toBe('unavailable'); await cache.dispose();
  await expect(cache.get(scope, input)).rejects.toThrow('disposed');
});
test('bounded eviction and disposal abort owned inference', async () => {
  const { cache, client } = fixture({ maxEntries: 1 }); let cancelled = false;
  client.score.mockImplementationOnce((_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { cancelled = true; reject(signal.reason); }, { once: true });
  }));
  const first = cache.get(scope, input); await setImmediate();
  await cache.get(scope, { ...input, query: 'new' }); expect((await first).status).toBe('unavailable'); expect(cancelled).toBe(true);
  await cache.dispose();
});
test('invalid cache parameters, scopes and input never invoke the scorer', async () => {
  expect(() => createCrossEncoderScoreCache()).toThrow('options_invalid');
  const { cache, client } = fixture();
  await expect(cache.get({ ...scope, access: 'unsafe' }, input)).rejects.toThrow('scope_invalid');
  await expect(cache.get(scope, { ...input, texts: [] })).rejects.toThrow('input_invalid');
  expect(client.score).not.toHaveBeenCalled(); await cache.dispose();
});
