/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS,
  verifyPolicyCompatibilityDeletionPreApplyChange,
} from './policyCompatibilityDeletionPreApplyChangeDetector.mjs';
import {
  buildRisk,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS,
  summarizePolicyControlledCompatibilityNamedScopePreApplyVerification,
} from './policyControlledCompatibilityNamedScopeRemovalAdapterShared.mjs';

function runPolicyControlledCompatibilityNamedScopePreApplyRecheck({
  entry,
  executionGate,
  preApplyChangeDetector = verifyPolicyCompatibilityDeletionPreApplyChange,
  repoRoot,
} = {}) {
  try {
    const verification = preApplyChangeDetector({
      entry,
      preflightEvidenceArtifact: executionGate.preflightEvidenceArtifact,
      repoRoot,
    });

    return {
      verification,
      risk: verification?.statusId ===
          POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS.VERIFIED &&
        verification?.verified === true &&
        verification?.validation?.ok === true
        ? null
        : buildRisk(
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
            .PRE_APPLY_RECHECK_FAILED,
          'Scope-aware removal requires a fresh, read-only checkout recheck before and after source capture.',
          summarizePolicyControlledCompatibilityNamedScopePreApplyVerification(verification)
        ),
    };
  } catch (_error) {
    return {
      verification: null,
      risk: buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
          .PRE_APPLY_RECHECK_FAILED,
        'Scope-aware removal requires a fresh, read-only checkout recheck before and after source capture.'
      ),
    };
  }
}

export {
  runPolicyControlledCompatibilityNamedScopePreApplyRecheck,
};
