/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { DiscoveryDeferredError } from './inventoryDiscoveryAdmission.mjs';

/** Retry admission only, never an entered callback, inference, or partial evaluation. */
export async function waitForInventoryDiscovery(admit, callback, { signal, waitMs = 0, onProgress = () => {} } = {},
  { now = () => performance.now(), sleep = (ms, signal) => setTimeout(ms, undefined, { signal }), random = Math.random } = {}) {
  if (!Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > 300_000) throw new Error('inventory_discovery_wait_invalid');
  const startedAt = now();
  let attempt = 0, last = null;
  while (true) {
    signal?.throwIfAborted();
    const elapsed = now() - startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error('inventory_discovery_wait_clock_invalid');
    if (last && elapsed >= waitMs) throw last;
    let entered = false;
    try {
      return await admit((...args) => { entered = true; return callback(...args); }, { signal });
    } catch (error) {
      signal?.throwIfAborted();
      if (entered || !(error instanceof DiscoveryDeferredError) || !waitMs) throw error;
      last = error;
      const remaining = waitMs - (now() - startedAt);
      if (!Number.isFinite(remaining) || remaining <= 0 || remaining > waitMs) throw error;
      const jitter = random();
      const retryInMs = Math.min(remaining, Math.ceil(Math.min(30_000, 5000 * 2 ** Math.min(attempt++, 3)) *
        (1 + (Number.isFinite(jitter) ? Math.max(0, Math.min(1, jitter)) : 0) * .25)));
      onProgress({ stage: 'discovery_wait', reason: error.reason, attempt, retryInMs });
      await sleep(retryInMs, signal);
    }
  }
}
