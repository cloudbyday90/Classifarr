/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { READINESS_SCOPES } from '../utils/databaseReadinessAdmission.mjs';
import { readInventoryRefreshReadiness, hasLiveInventoryRefreshQueryFailure } from './inventoryRefreshReadinessReader.mjs';
import { createInventoryRefreshReadinessFailure } from './inventoryRefreshReadinessDiagnostics.mjs';
import { withBoundedInventoryReadiness } from './boundedInventoryReadinessGuard.mjs';

/** Opt-in lifecycle for the two refresh probes; generic readiness stays unchanged. */
export function withInventoryRefreshReadiness(worker, database, scope, read = readInventoryRefreshReadiness) {
  if (![READINESS_SCOPES.DESCRIPTION, READINESS_SCOPES.REPRESENTATIVE].includes(scope)) throw new TypeError('inventory_refresh_readiness_scope_invalid');
  return withBoundedInventoryReadiness(worker, database, scope, {
    read,
    diagnoseFailure(error, { signal, deadlineExpired }) {
      if (!deadlineExpired || hasLiveInventoryRefreshQueryFailure(error, signal)) return createInventoryRefreshReadinessFailure(error);
    },
  });
}
