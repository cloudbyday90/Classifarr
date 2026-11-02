/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { createAdjudicationFinalizationClaim } from './adjudicationFinalizationClaim.mjs';

/** Capture alone receives a fixed claim operation; the connection never escapes. */
export function createAdjudicationFinalizationAdmission(options) {
  return createInventoryDiscoveryAdmission({ ...options,
    createOwnerContext: scope => Object.freeze({ claimFinalization: createAdjudicationFinalizationClaim(scope) }) });
}
