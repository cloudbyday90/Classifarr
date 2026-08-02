/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_VERSION =
  'policy.controlled_compatibility_named_scope_removal_adapter.v1';
const MAX_POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_BYTES = 5 * 1024 * 1024;

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS = Object.freeze({
  READY_FOR_SCOPE_REMOVAL_REVIEW: 'ready_for_scope_removal_review',
  BLOCKED_BY_EXECUTION_GATE: 'blocked_by_execution_gate',
  BLOCKED_BY_SCOPE_IDENTITY: 'blocked_by_scope_identity',
  BLOCKED_BY_PREFLIGHT_RECHECK: 'blocked_by_preflight_recheck',
  BLOCKED_BY_SOURCE: 'blocked_by_source',
});

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS = Object.freeze({
  EXECUTION_GATE_INVALID: 'execution_gate_invalid',
  EXECUTION_GATE_NOT_READY: 'execution_gate_not_ready',
  EXECUTION_GATE_REVALIDATION_FAILED: 'execution_gate_revalidation_failed',
  EXECUTION_GATE_REVALIDATION_NOT_READY: 'execution_gate_revalidation_not_ready',
  PREFLIGHT_ENTRY_IDENTITY_AMBIGUOUS: 'preflight_entry_identity_ambiguous',
  PREFLIGHT_ENTRY_IDENTITY_MISSING: 'preflight_entry_identity_missing',
  PREFLIGHT_ENTRY_NOT_OBSERVED: 'preflight_entry_not_observed',
  PRE_APPLY_RECHECK_FAILED: 'pre_apply_recheck_failed',
  SELECTED_ENTRY_IDENTITY_AMBIGUOUS: 'selected_entry_identity_ambiguous',
  SELECTED_ENTRY_IDENTITY_INVALID: 'selected_entry_identity_invalid',
  SELECTED_ENTRY_IDENTITY_MISSING: 'selected_entry_identity_missing',
  SELECTED_ENTRY_NOT_NAMED_SCOPE: 'selected_entry_not_named_scope',
  SELECTED_ENTRY_NOT_READY: 'selected_entry_not_ready',
  SELECTED_ENTRY_REPLACEMENT_EVIDENCE_INVALID:
    'selected_entry_replacement_evidence_invalid',
  SELECTED_ENTRY_VALIDATION_FAILED: 'selected_entry_validation_failed',
  SOURCE_FILE_MISSING: 'source_file_missing',
  SOURCE_FILE_NOT_REGULAR: 'source_file_not_regular',
  SOURCE_FILE_READ_FAILED: 'source_file_read_failed',
  SOURCE_FILE_SYMLINK: 'source_file_symlink',
  SOURCE_FILE_TOO_LARGE: 'source_file_too_large',
  SOURCE_PATH_INVALID: 'source_path_invalid',
  SOURCE_PATH_REALPATH_CHANGED: 'source_path_realpath_changed',
  SOURCE_ROOT_UNAVAILABLE: 'source_root_unavailable',
  UNKNOWN_STATUS: 'unknown_status',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  READY_STATE_MISMATCH: 'ready_state_mismatch',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function buildPolicyControlledCompatibilityNamedScopeRemovalAdapterSideEffects() {
  return {
    filesDeleted: false,
    filesArchived: false,
    routesRemoved: false,
    testsRemoved: false,
    storageChanged: false,
    manifestWritten: false,
    gitCommandsRun: false,
    sourceWritten: false,
  };
}

function summarizePolicyControlledCompatibilityNamedScopePreApplyVerification(verification = {}) {
  const value = asObject(verification);

  return {
    statusId: value.statusId || null,
    validationOk: value.validation?.ok === true,
    verified: value.verified === true,
    riskIds: asArray(value.risks).map(risk => risk?.riskId).filter(Boolean),
  };
}

function determinePolicyControlledCompatibilityNamedScopeRemovalAdapterStatusId(risks = []) {
  const riskIds = new Set(risks.map(risk => risk.riskId));

  if ([
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.EXECUTION_GATE_INVALID,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.EXECUTION_GATE_NOT_READY,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
      .EXECUTION_GATE_REVALIDATION_FAILED,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
      .EXECUTION_GATE_REVALIDATION_NOT_READY,
  ].some(riskId => riskIds.has(riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS
      .BLOCKED_BY_EXECUTION_GATE;
  }
  if ([
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
      .SELECTED_ENTRY_IDENTITY_AMBIGUOUS,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
      .SELECTED_ENTRY_IDENTITY_INVALID,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
      .SELECTED_ENTRY_IDENTITY_MISSING,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SELECTED_ENTRY_NOT_NAMED_SCOPE,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SELECTED_ENTRY_NOT_READY,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
      .SELECTED_ENTRY_REPLACEMENT_EVIDENCE_INVALID,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
      .SELECTED_ENTRY_VALIDATION_FAILED,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
      .PREFLIGHT_ENTRY_IDENTITY_AMBIGUOUS,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
      .PREFLIGHT_ENTRY_IDENTITY_MISSING,
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.PREFLIGHT_ENTRY_NOT_OBSERVED,
  ].some(riskId => riskIds.has(riskId))) {
    return POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS
      .BLOCKED_BY_SCOPE_IDENTITY;
  }
  if (riskIds.has(
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.PRE_APPLY_RECHECK_FAILED
  )) {
    return POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS
      .BLOCKED_BY_PREFLIGHT_RECHECK;
  }

  return POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS.BLOCKED_BY_SOURCE;
}

function buildPolicyControlledCompatibilityNamedScopeRemovalAdapterNextStep({
  readyForScopeRemovalReview,
} = {}) {
  return readyForScopeRemovalReview
    ? {
      stepId: 'scope_aware_removal_review_artifact',
      label: 'Scope-Aware Removal Review Artifact',
      reason:
        'The exact source snapshot and bounded dry-run edits must be fingerprinted into a separate review artifact before any future mutation capability is considered.',
    }
    : {
      stepId: 'resolve_scope_aware_removal_blocker',
      label: 'Resolve Scope-Aware Removal Blocker',
      reason:
        'The retained test file was not safe to convert into a bounded named-scope dry-run edit; refresh evidence or resolve the exact blocker without widening scope.',
    };
}

export {
  MAX_POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_BYTES,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_VERSION,
  asArray,
  asObject,
  buildPolicyControlledCompatibilityNamedScopeRemovalAdapterNextStep,
  buildPolicyControlledCompatibilityNamedScopeRemovalAdapterSideEffects,
  buildRisk,
  determinePolicyControlledCompatibilityNamedScopeRemovalAdapterStatusId,
  summarizePolicyControlledCompatibilityNamedScopePreApplyVerification,
};
