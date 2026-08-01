/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS = Object.freeze({
  HANDOFF_READY: 'handoff_ready',
  BLOCKED_BY_ASSEMBLY: 'blocked_by_assembly',
  BLOCKED_BY_RELEASE_READINESS: 'blocked_by_release_readiness',
  BLOCKED_BY_APPROVED_ARTIFACT: 'blocked_by_approved_artifact',
  BLOCKED_BY_ARTIFACT_COVERAGE: 'blocked_by_artifact_coverage',
  BLOCKED_BY_EXECUTION_GATE: 'blocked_by_execution_gate',
  BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
});

const POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS =
  Object.freeze({
    COVERED: 'covered',
    MISSING: 'missing',
    AMBIGUOUS: 'ambiguous',
  });

const POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS = Object.freeze({
  ASSEMBLY_MISSING: 'assembly_missing',
  ASSEMBLY_VERSION_UNKNOWN: 'assembly_version_unknown',
  ASSEMBLY_NOT_READY: 'assembly_not_ready',
  ASSEMBLY_NOT_READ_ONLY: 'assembly_not_read_only',
  ASSEMBLY_AUTHORIZES_DELETION: 'assembly_authorizes_deletion',
  ASSEMBLY_MANIFEST_WRITTEN: 'assembly_manifest_written',
  ASSEMBLY_VALIDATION_FAILED: 'assembly_validation_failed',
  RELEASE_READINESS_MISSING: 'release_readiness_missing',
  RELEASE_READINESS_VERSION_UNKNOWN: 'release_readiness_version_unknown',
  RELEASE_READINESS_NOT_READY: 'release_readiness_not_ready',
  RELEASE_READINESS_VALIDATION_FAILED: 'release_readiness_validation_failed',
  APPROVED_ARTIFACT_MISSING: 'approved_artifact_missing',
  APPROVED_ARTIFACT_VERSION_UNKNOWN: 'approved_artifact_version_unknown',
  APPROVED_ARTIFACT_NOT_READY: 'approved_artifact_not_ready',
  APPROVED_ARTIFACT_VALIDATION_FAILED: 'approved_artifact_validation_failed',
  APPROVED_ARTIFACT_MANIFEST_UNAPPROVED: 'approved_artifact_manifest_unapproved',
  APPROVED_ARTIFACT_EXECUTION_PLAN_NOT_READY: 'approved_artifact_execution_plan_not_ready',
  ARTIFACT_TARGET_MISSING: 'artifact_target_missing',
  ARTIFACT_TARGET_AMBIGUOUS: 'artifact_target_ambiguous',
  EXECUTION_GATE_MISSING: 'execution_gate_missing',
  EXECUTION_GATE_VERSION_UNKNOWN: 'execution_gate_version_unknown',
  EXECUTION_GATE_NOT_READY: 'execution_gate_not_ready',
  EXECUTION_GATE_VALIDATION_FAILED: 'execution_gate_validation_failed',
  EXECUTION_GATE_ARTIFACT_MISMATCH: 'execution_gate_artifact_mismatch',
  UNKNOWN_VERSION: 'unknown_version',
  UNKNOWN_STATUS: 'unknown_status',
  AUDIT_NOT_READ_ONLY: 'audit_not_read_only',
  AUDIT_AUTHORIZES_DELETION: 'audit_authorizes_deletion',
  AUDIT_MANIFEST_WRITTEN: 'audit_manifest_written',
  AUDIT_ARTIFACT_WRITTEN: 'audit_artifact_written',
  AUDIT_EXECUTION_GATE_INVOKED: 'audit_execution_gate_invoked',
  COVERAGE_COUNT_MISMATCH: 'coverage_count_mismatch',
  READY_STATE_MISMATCH: 'ready_state_mismatch',
  ISSUE_COUNT_MISMATCH: 'issue_count_mismatch',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value) {
  return cleanString(value).replace(/\\/g, '/');
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))].sort();
}

function sameStringList(left, right) {
  return JSON.stringify(uniqueStrings(left)) === JSON.stringify(uniqueStrings(right));
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function buildSideEffects(sideEffects = {}) {
  return {
    filesDeleted: sideEffects.filesDeleted === true,
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

export {
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS,
  asArray,
  asObject,
  buildRisk,
  buildSideEffects,
  cleanString,
  hasSideEffects,
  normalizePath,
  sameStringList,
  uniqueStrings,
};
