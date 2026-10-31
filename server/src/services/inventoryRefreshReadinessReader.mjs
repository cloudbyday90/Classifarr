/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryBackgroundReadiness } from './inventoryBackgroundReadiness.mjs';
import { observeRepresentativeDatabaseOperation, observeRepresentativeTransaction } from './inventoryRepresentativeRefreshObservation.mjs';

/** Opt-in attribution: reuse readiness policy without observing application projection as SQL. */
export function readInventoryRefreshReadiness(database) {
  return readInventoryBackgroundReadiness({
    withTransaction: callback => observeRepresentativeTransaction(
      operation => database.withTransaction(operation),
      client => callback({ query: (...args) => observeRepresentativeDatabaseOperation(() => client.query(...args)) }),
    ),
  });
}
