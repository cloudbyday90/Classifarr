/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryBackgroundReadiness, INVENTORY_BACKGROUND_READINESS_SQL } from './inventoryBackgroundReadiness.mjs';
import { observeRepresentativeDatabaseOperation, observeRepresentativeTransaction } from './inventoryRepresentativeRefreshObservation.mjs';

/** Opt-in attribution: reuse readiness policy without observing application projection as SQL. */
export function readInventoryRefreshReadiness(database, options) {
  if (options !== undefined) return readBounded(database, options);
  return readInventoryBackgroundReadiness({
    withTransaction: callback => observeRepresentativeTransaction(
      operation => database.withTransaction(operation),
      client => callback({ query: (...args) => observeRepresentativeDatabaseOperation(() => client.query(...args)) }),
    ),
  });
}

export const INVENTORY_REFRESH_PROBE_MS = 3000;
const liveQueryFailures = new WeakMap();
export const hasLiveInventoryRefreshQueryFailure = (error, signal) => liveQueryFailures.get(signal)?.has(error) === true;

async function readBounded(database, { signal, scope }) {
  let queryFailure;
  try {
    return await observeRepresentativeTransaction(
      operation => database.withTransaction(operation, { signal, readOnly: true,
        timeoutMs: INVENTORY_REFRESH_PROBE_MS, readinessScope: scope }),
      async client => {
        let result;
        try {
          result = await observeRepresentativeDatabaseOperation(() => client.query(INVENTORY_BACKGROUND_READINESS_SQL));
        } catch (error) {
          // Freeze eligibility before a local abort or the shared runner's
          // 57014 -> AbortError replacement; never infer proof from that replacement.
          if (!signal.aborted) {
            queryFailure = error;
            let failures = liveQueryFailures.get(signal);
            if (!failures) { failures = new WeakSet(); liveQueryFailures.set(signal, failures); }
            failures.add(error);
          }
          throw error;
        }
        return result.rows[0]?.readiness ?? 'unavailable';
      },
    );
  } catch (error) {
    if (queryFailure) throw queryFailure;
    throw error;
  }
}
