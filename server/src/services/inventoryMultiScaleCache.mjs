/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createLiveInventoryModelCache } from './liveInventoryModelCache.mjs';
import { prepareMultiScaleSource } from './inventoryMultiScaleSource.mjs';
import { buildMultiScaleProfile } from './inventoryMultiScaleProfile.mjs';

function joinBuild(entry, signal) {
  entry.waiters++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true; signal?.removeEventListener('abort', cancel);
      if (--entry.waiters === 0 && !entry.done) entry.controller.abort();
      callback(value);
    };
    const cancel = () => finish(reject, new Error('multi_scale_cancelled'));
    signal?.addEventListener('abort', cancel, { once: true });
    entry.promise.then(result => finish(resolve, result), error => finish(reject, error));
    if (signal?.aborted) cancel();
  });
}

/** One owned completed profile and one bounded in-flight build; no global singleton. */
export function createMultiScaleProfileLoader({ build = buildMultiScaleProfile, now } = {}) {
  const cache = createLiveInventoryModelCache({ maxEntries: 1, maxWeight: 256 * 1024 * 1024, ttlMs: 300_000, ...(now ? { now } : {}) });
  let flight = null;
  return Object.freeze({
    clear() { cache.clear(); flight?.controller.abort(); },
    async load(snapshot, representation, { held, signal } = {}) {
      signal?.throwIfAborted();
      if (flight?.waiters >= 8) throw new Error('multi_scale_busy');
      const source = prepareMultiScaleSource(snapshot, representation, held);
      signal?.throwIfAborted();
      const cached = cache.get(source.key);
      if (cached) return { profile: cached, cache: 'hit' };
      if (flight) {
        if (flight.key !== source.key || flight.controller.signal.aborted) throw new Error('multi_scale_busy');
        return { profile: (await joinBuild(flight, signal)).handle, cache: 'shared' };
      }
      const entry = { key: source.key, controller: new AbortController(), waiters: 0, done: false };
      const abort = AbortSignal.any([entry.controller.signal, AbortSignal.timeout(360_000)]);
      flight = entry;
      entry.promise = Promise.resolve().then(() => build(source, { signal: abort })).then(result => {
        abort.throwIfAborted();
        if (result.cacheable) cache.set(entry.key, result.handle, result.weight);
        return result;
      }).finally(() => { entry.done = true; if (flight === entry) flight = null; });
      return { profile: (await joinBuild(entry, signal)).handle, cache: 'miss' };
    },
  });
}
