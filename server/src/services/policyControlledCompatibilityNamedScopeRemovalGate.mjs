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
  buildPolicyCompatibilityDeletionExecutionGate,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
  validatePolicyCompatibilityDeletionExecutionGate,
} from './policyCompatibilityDeletionExecutionGate.mjs';
import {
  asObject,
  buildRisk,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS,
} from './policyControlledCompatibilityNamedScopeRemovalAdapterShared.mjs';

function evaluatePolicyControlledCompatibilityNamedScopeRemovalGate({
  executionGate,
  now,
} = {}) {
  const gate = asObject(executionGate);
  const validation = validatePolicyCompatibilityDeletionExecutionGate(gate);
  const risks = [];

  if (validation.ok !== true || gate.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.EXECUTION_GATE_INVALID,
      'Scope-aware removal requires a valid serialized compatibility deletion execution gate.',
      { issueCount: validation.issueCount }
    ));
  }
  if (
    gate.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.READY_FOR_CONTROLLED_DELETION ||
    gate.allowControlledDeletion !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.EXECUTION_GATE_NOT_READY,
      'Scope-aware removal requires a ready compatibility deletion execution gate.',
      { statusId: gate.statusId || null }
    ));
  }

  const revalidatedGate = buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact: gate.executionPlanArtifact,
    generatedAt: now,
    maxEvidenceAgeMs: gate.executionPolicy?.maxEvidenceAgeMs,
    now,
    operatorEvidence: gate.operatorEvidence,
    preflightEvidenceArtifact: gate.preflightEvidenceArtifact,
    recoveryEvidence: gate.recoveryEvidence,
  });

  if (revalidatedGate.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .EXECUTION_GATE_REVALIDATION_FAILED,
      'Scope-aware removal requires the embedded execution gate evidence to validate again at dry-run time.',
      { issueCount: revalidatedGate.validation?.issueCount ?? null }
    ));
  }
  if (
    revalidatedGate.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.READY_FOR_CONTROLLED_DELETION ||
    revalidatedGate.allowControlledDeletion !== true
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .EXECUTION_GATE_REVALIDATION_NOT_READY,
      'Scope-aware removal requires fresh recovery, stance, approval, manifest, and preflight evidence.',
      { statusId: revalidatedGate.statusId || null }
    ));
  }

  return { gate, revalidatedGate, risks };
}

export {
  evaluatePolicyControlledCompatibilityNamedScopeRemovalGate,
};
