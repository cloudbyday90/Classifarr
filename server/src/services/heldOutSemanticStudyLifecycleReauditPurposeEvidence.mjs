/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { buildPolicyPurposeEvidenceInventory } from './policyPurposeEvidenceInventory.mjs';
import { loadPolicyPurposeEvidenceInventoryRecord } from './policyPurposeEvidenceInventoryPersistence.mjs';

export const HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_PURPOSE_EVIDENCE_VERSION =
  'policy.held_out_semantic_study_lifecycle_reaudit_purpose_evidence.v1';

/**
 * Reduces the established policy-purpose evidence inventory to the sole
 * aggregate needed by lifecycle re-audit. It deliberately does not carry
 * policy, library, configuration, receipt, or media identity forward.
 */
export function buildHeldOutSemanticStudyLifecycleReauditPurposeEvidence(record = {}) {
  const inventory = buildPolicyPurposeEvidenceInventory(record);

  return Object.freeze({
    version: HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_PURPOSE_EVIDENCE_VERSION,
    completePolicyEvidenceCount: inventory.completePolicyEvidenceCount,
    completePolicyEvidenceAvailable: inventory.completePolicyEvidenceAvailable,
    rawConfigurationExposed: false,
    libraryIdentityExposed: false,
    mediaIdentityExposed: false,
  });
}

export async function loadHeldOutSemanticStudyLifecycleReauditPurposeEvidenceRecord({ db }) {
  return loadPolicyPurposeEvidenceInventoryRecord({ db });
}
