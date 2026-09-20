/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assessDiscoveryMemory, readDiscoveryMemory } from './discoveryMemoryBudget.mjs';

export const INVENTORY_DISCOVERY_LOCK = 0x49444d47;

export class DiscoveryDeferredError extends Error {
  constructor(reason) {
    super('inventory_discovery_deferred');
    this.reason = ['busy', 'memory_pressure', 'memory_unknown'].includes(reason) ? reason : 'memory_unknown';
  }
}

/** One database-scoped heavy job. The lease is not released until cancellation has settled. */
export function createInventoryDiscoveryAdmission({ withSessionAdvisoryLock, readMemory = readDiscoveryMemory }) {
  let active = false;
  return async function withAdmission(callback, { signal } = {}) {
    signal?.throwIfAborted();
    if (active) throw new DiscoveryDeferredError('busy');
    active = true;
    try {
      let result;
      const acquired = await withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, async ({ signal: lockSignal } = {}) => {
        const pressure = new AbortController();
        const abort = AbortSignal.any([pressure.signal, ...[signal, lockSignal].filter(Boolean)]);
        const check = starting => {
          try {
            const memory = assessDiscoveryMemory(readMemory(), starting);
            if (!memory.allowed) pressure.abort(new DiscoveryDeferredError(memory.reason));
          } catch { pressure.abort(new DiscoveryDeferredError('memory_unknown')); }
        };
        check(true); abort.throwIfAborted();
        const timer = setInterval(() => check(false), 250);
        timer.unref();
        const checkpoint = () => { check(false); abort.throwIfAborted(); };
        try {
          result = await callback(abort, checkpoint);
          checkpoint();
        } catch (error) {
          // Fitting adapters may replace cancellation errors. Preserve the fixed pressure reason.
          abort.throwIfAborted();
          throw error;
        } finally { clearInterval(timer); }
      });
      if (!acquired) throw new DiscoveryDeferredError('busy');
      signal?.throwIfAborted();
      return result;
    } finally { active = false; }
  };
}
