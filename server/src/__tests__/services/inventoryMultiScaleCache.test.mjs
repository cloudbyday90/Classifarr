/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { setImmediate } from 'node:timers/promises';
import { createMultiScaleProfileLoader } from '../../services/inventoryMultiScaleCache.mjs';
import { fixture, representation } from '../fixtures/inventoryMultiScaleFixture.mjs';
const result = () => ({ cacheable: true, weight: 1000, handle: Object.freeze({}) });
const setup = dependencies => {
  const snapshot = fixture(), held = new Set([snapshot.corpus.documents[0].hash]), loader = createMultiScaleProfileLoader(dependencies);
  return { loader, load: (options = {}, identity = representation) => loader.load(snapshot, identity, { held, ...options }) };
};

test('reuses a completed fit, expires it, evicts changed identities and clears explicitly', async () => {
  let time = 0;
  const build = jest.fn(async () => result()), { loader, load } = setup({ build, now: () => time });
  const first = await load(); expect(first.cache).toBe('miss');
  expect(await load()).toEqual({ profile: first.profile, cache: 'hit' });
  time = 300_000; expect((await load()).cache).toBe('miss');
  expect((await load({}, { ...representation, digest: 'b'.repeat(64) })).cache).toBe('miss');
  expect((await load()).cache).toBe('miss');
  loader.clear(); expect((await load()).cache).toBe('miss');
  expect(build).toHaveBeenCalledTimes(5);
});

test('copies vectors only for an admitted build, validates hits, and owns before the first yield', async () => {
  const snapshot = fixture(), held = new Set([snapshot.corpus.documents[0].hash]);
  const vector = snapshot.vectors.get(snapshot.corpus.documents[1].hash), original = [...vector];
  let copies = 0, captured, complete;
  vector[Symbol.iterator] = function* () { copies++; yield* original; };
  const build = jest.fn(source => { captured = source; return new Promise(resolve => { complete = resolve; }); });
  const loader = createMultiScaleProfileLoader({ build }), load = () => loader.load(snapshot, representation, { held });
  const first = load(), shared = load();
  expect(copies).toBe(1);
  vector[0] = 0.25;
  await setImmediate();
  expect(captured.training.vectors.get(snapshot.corpus.documents[1].hash)).toEqual(original);
  complete(result()); await Promise.all([first, shared]);
  vector[0] = original[0];
  expect((await load()).cache).toBe('hit'); expect(copies).toBe(1);
  vector[0] = NaN;
  await expect(load()).rejects.toThrow(); expect(copies).toBe(1);
  loader.clear();
});

test('shares same-key work, bounds waiters, rejects different-key concurrent work and isolates caller cancellation', async () => {
  let complete, buildSignal;
  const build = jest.fn((_source, { signal }) => { buildSignal = signal; return new Promise(resolve => { complete = resolve; }); });
  const { load } = setup({ build }), controller = new AbortController();
  const first = load({ signal: controller.signal });
  const rejected = expect(first).rejects.toThrow('cancelled');
  const shared = load(); await setImmediate();
  await expect(load({}, { ...representation, model: 'other' })).rejects.toThrow('busy');
  const more = Array.from({ length: 6 }, () => load());
  await expect(load()).rejects.toThrow('busy');
  controller.abort(); await rejected; expect(buildSignal.aborted).toBe(false);
  complete(result());
  const all = await Promise.all([shared, ...more]);
  expect(all.every(row => row.cache === 'shared' && row.profile === all[0].profile)).toBe(true);
  expect(build).toHaveBeenCalledTimes(1); expect((await load()).cache).toBe('hit');
});

test('last cancelled waiter aborts build, prevents late publication and allows a fresh retry', async () => {
  let complete, buildSignal;
  const build = jest.fn((_source, { signal }) => { buildSignal = signal; return new Promise(resolve => { complete = resolve; }); });
  const { load } = setup({ build }), controller = new AbortController();
  await expect(load({ signal: AbortSignal.abort() })).rejects.toThrow();
  const first = load({ signal: controller.signal }), rejected = expect(first).rejects.toThrow('cancelled');
  await setImmediate(); controller.abort(); await rejected;
  expect(buildSignal.aborted).toBe(true); await expect(load()).rejects.toThrow('busy');
  complete(result()); await setImmediate();
  build.mockResolvedValueOnce(result()); expect((await load()).cache).toBe('miss');
});

test('clear/deadline suppress publication, and failure/degraded/oversized results are retryable', async () => {
  for (const [index, outcome] of [() => Promise.reject(new Error('fit_failed')),
    () => ({ ...result(), cacheable: false }), () => ({ ...result(), weight: 300 * 1024 * 1024 })].entries()) {
    const build = jest.fn(outcome), { load } = setup({ build });
    if (index === 0) await expect(load()).rejects.toThrow('fit_failed');
    else await expect(load()).resolves.toMatchObject({ cache: 'miss' });
    build.mockResolvedValueOnce(result());
    expect((await load()).cache).toBe('miss'); expect(build).toHaveBeenCalledTimes(2);
  }
  for (const deadline of [false, true]) {
    const controller = new AbortController();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    let complete;
    const { loader, load } = setup({ build: () => new Promise(resolve => { complete = resolve; }) });
    try {
      const pending = load(), rejected = expect(pending).rejects.toThrow(); await setImmediate();
      if (deadline) controller.abort(); else loader.clear();
      complete(result()); await rejected;
    } finally { timeout.mockRestore(); }
  }
});
