/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const READINESS_SCOPES = Object.freeze({
  DESCRIPTION: 'inventory_description_refresh',
  REPRESENTATIVE: 'inventory_representative_refresh',
  SOURCE_PAIR: 'automatic_source_pair',
  WORKLOAD_MONITOR: 'evaluation_workload_monitor',
  WORKLOAD_RESERVATION: 'evaluation_workload_reservation',
});
const scopes = new Set(Object.values(READINESS_SCOPES));
const deferred = new WeakSet();
export const isDatabaseReadinessAdmissionDeferred = error => deferred.has(error);

/** Database-module lifetime, fixed scopes, no queue and no early drain claim. */
export function createDatabaseReadinessAdmission() {
  const occupied = new Set();
  return {
    async run(scope, connect, operation) {
      if (!scopes.has(scope)) throw new TypeError('database_readiness_scope_invalid');
      if (occupied.has(scope)) {
        const error = new Error('database_readiness_scope_occupied');
        deferred.add(error);
        throw error;
      }
      occupied.add(scope);
      let acquisition, closed = false;
      try {
        return await operation(() => {
          if (closed || acquisition) throw new Error('database_readiness_acquisition_closed');
          acquisition = Promise.resolve(connect());
          return acquisition;
        });
      } finally {
        closed = true;
        // The read may have returned AbortError while connect is still queued.
        // Its existing late-grant handler was registered before these handlers.
        if (acquisition) acquisition.then(() => occupied.delete(scope), () => occupied.delete(scope));
        else occupied.delete(scope);
      }
    },
  };
}
