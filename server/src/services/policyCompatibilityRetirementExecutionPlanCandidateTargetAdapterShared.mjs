/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_VERSION =
  'policy.compatibility_retirement_execution_plan_candidate_target_adapter.v1';

const POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_INPUT_VERSION =
  'policy.compatibility_retirement_execution_plan_candidate_target_input.v1';

const POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS =
  Object.freeze({
    ADAPTER_READY: 'adapter_ready',
    BLOCKED_BY_CANDIDATE: 'blocked_by_candidate',
    BLOCKED_BY_ASSEMBLY: 'blocked_by_assembly',
    BLOCKED_BY_MAPPING: 'blocked_by_mapping',
    BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
  });

const POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS =
  Object.freeze({
    CANDIDATE_MISSING: 'candidate_missing',
    CANDIDATE_NOT_READY: 'candidate_not_ready',
    CANDIDATE_NOT_READ_ONLY: 'candidate_not_read_only',
    CANDIDATE_AUTHORIZES_DELETION: 'candidate_authorizes_deletion',
    CANDIDATE_VALIDATION_FAILED: 'candidate_validation_failed',
    ASSEMBLY_MISSING: 'assembly_missing',
    ASSEMBLY_NOT_READY: 'assembly_not_ready',
    ASSEMBLY_NOT_READ_ONLY: 'assembly_not_read_only',
    ASSEMBLY_AUTHORIZES_DELETION: 'assembly_authorizes_deletion',
    ASSEMBLY_MANIFEST_WRITTEN: 'assembly_manifest_written',
    ASSEMBLY_VALIDATION_FAILED: 'assembly_validation_failed',
    MAPPING_COUNT_MISMATCH: 'mapping_count_mismatch',
    MAPPING_TARGET_MISSING: 'mapping_target_missing',
    MAPPING_TARGET_DUPLICATE: 'mapping_target_duplicate',
    MAPPING_NOT_READY: 'mapping_not_ready',
    MAPPING_CATEGORY_MISSING: 'mapping_category_missing',
    MAPPING_ACTION_MISMATCH: 'mapping_action_mismatch',
    EXECUTION_PLAN_INPUT_MISMATCH: 'execution_plan_input_mismatch',
    EXECUTION_PLAN_INPUT_APPROVED: 'execution_plan_input_approved',
    EXECUTION_PLAN_INPUT_EXECUTION_REQUESTED: 'execution_plan_input_execution_requested',
    ADAPTER_NOT_READ_ONLY: 'adapter_not_read_only',
    ADAPTER_AUTHORIZES_DELETION: 'adapter_authorizes_deletion',
    ADAPTER_MANIFEST_WRITTEN: 'adapter_manifest_written',
    ADAPTER_ARTIFACT_WRITTEN: 'adapter_artifact_written',
    ADAPTER_EXECUTION_GATE_INVOKED: 'adapter_execution_gate_invoked',
    READY_STATE_MISMATCH: 'ready_state_mismatch',
    ISSUE_COUNT_MISMATCH: 'issue_count_mismatch',
    UNKNOWN_VERSION: 'unknown_version',
    UNKNOWN_STATUS: 'unknown_status',
    SIDE_EFFECT_REPORTED: 'side_effect_reported',
  });

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value) {
  return cleanString(value).replace(/\\/g, '/').toLowerCase();
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))].sort();
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function buildSideEffects(sideEffects = {}) {
  return {
    filesDeleted: sideEffects.filesDeleted === true,
    testsDeleted: sideEffects.testsDeleted === true,
    sourceFilesRewritten: sideEffects.sourceFilesRewritten === true,
    storageChanged: sideEffects.storageChanged === true,
    executionManifestWritten: sideEffects.executionManifestWritten === true,
    executionPlanArtifactWritten: sideEffects.executionPlanArtifactWritten === true,
    executionGateInvoked: sideEffects.executionGateInvoked === true,
  };
}

function hasSideEffects(sideEffects = {}) {
  return Object.values(sideEffects).some(Boolean);
}

function buildExecutionPlanTargetInputKey(entry = {}) {
  return JSON.stringify({
    categoryId: cleanString(entry.categoryId),
    actionId: cleanString(entry.actionId),
    path: normalizePath(entry.path),
    targetKindId: cleanString(entry.targetKindId),
    componentPath: normalizePath(entry.componentPath),
    dependencyIds: uniqueStrings(entry.dependencyIds),
    sourceTextFragments: uniqueStrings(entry.sourceTextFragments),
    testNameFragments: uniqueStrings(entry.testNameFragments),
    wholeFileDeletion: entry.wholeFileDeletion === false ? false : null,
  });
}

export {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_VERSION,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_INPUT_VERSION,
  asArray,
  buildExecutionPlanTargetInputKey,
  buildRisk,
  buildSideEffects,
  cleanString,
  hasSideEffects,
  uniqueStrings,
};
