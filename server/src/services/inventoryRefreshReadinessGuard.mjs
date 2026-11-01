/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { READINESS_SCOPES, isDatabaseReadinessAdmissionDeferred } from '../utils/databaseReadinessAdmission.mjs';
import { INVENTORY_REFRESH_PROBE_MS, readInventoryRefreshReadiness, hasLiveInventoryRefreshQueryFailure } from './inventoryRefreshReadinessReader.mjs';
import { createInventoryRefreshReadinessFailure } from './inventoryRefreshReadinessDiagnostics.mjs';

/** Opt-in lifecycle for the two refresh probes; generic readiness stays unchanged. */
export function withInventoryRefreshReadiness(worker, database, scope, read = readInventoryRefreshReadiness) {
  if (!Object.values(READINESS_SCOPES).includes(scope)) throw new TypeError('inventory_refresh_readiness_scope_invalid');
  const stop = new AbortController();
  let stopped = false, active = null;
  return {
    ...worker,
    stop() { stopped = true; stop.abort(); worker.stop(); },
    run(...args) {
      if (stopped) return Promise.resolve({ status: 'stopped' });
      const owner = args[0]?.signal;
      if (owner?.aborted) return Promise.resolve({ status: 'cancelled' });
      active ??= (async () => {
        const deadline = new AbortController();
        const signal = AbortSignal.any([stop.signal, deadline.signal, ...(owner ? [owner] : [])]);
        const timer = setTimeout(() => deadline.abort(), INVENTORY_REFRESH_PROBE_MS);
        timer.unref?.();
        let reason, failure;
        try {
          try { reason = await read(database, { signal, scope }); }
          catch (error) {
            reason = 'unavailable';
            if (!stopped && !owner?.aborted && !isDatabaseReadinessAdmissionDeferred(error) &&
                (!deadline.signal.aborted || hasLiveInventoryRefreshQueryFailure(error, signal))) {
              try { failure = createInventoryRefreshReadinessFailure(error); } catch { /* Diagnosis cannot admit work. */ }
            }
          }
        } finally {
          // The probe budget never becomes the admitted worker's deadline.
          clearTimeout(timer);
        }
        if (stopped) return { status: 'stopped' };
        if (owner?.aborted) return { status: 'cancelled' };
        if (reason !== 'ready') return { status: 'deferred', reason, ...(failure ? { failure } : {}) };
        if (deadline.signal.aborted) return { status: 'deferred', reason: 'unavailable' };
        return worker.run(...args);
      })().finally(() => { active = null; });
      return active;
    },
  };
}
