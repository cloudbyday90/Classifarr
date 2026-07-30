/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_LIBRARY_REBUILD_CUTOVER_VERSION =
  'policy.library_rebuild_cutover.v1';

const POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS = Object.freeze({
  CUTOVER_APPLIED: 'cutover_applied',
  ALREADY_APPLIED: 'already_applied',
  BLOCKED_BY_TRANSITION: 'blocked_by_transition',
  VERIFICATION_NOT_READY: 'verification_not_ready',
  SNAPSHOT_BLOCKED: 'snapshot_blocked',
  REPLACEMENT_BLOCKED: 'replacement_blocked',
  ORCHESTRATION_BOUNDARY_UNAVAILABLE: 'orchestration_boundary_unavailable',
  FAILED: 'failed',
});

const POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS = Object.freeze({
  INVALID_EXECUTION_TIME: 'invalid_execution_time',
  ORCHESTRATION_BOUNDARY_REQUIRED: 'orchestration_boundary_required',
  UNSAFE_VERIFICATION_HANDOFF: 'unsafe_verification_handoff',
  VERIFICATION_NOT_READY: 'verification_not_ready',
  UNSAFE_SNAPSHOT_GATE: 'unsafe_snapshot_gate',
  SNAPSHOT_BLOCKED: 'snapshot_blocked',
  UNSAFE_REPLACEMENT_GATE: 'unsafe_replacement_gate',
  REPLACEMENT_BLOCKED: 'replacement_blocked',
  UNEXPECTED_ORCHESTRATION_FAILURE: 'unexpected_orchestration_failure',
  LEGACY_DELETION_FORBIDDEN: 'legacy_deletion_forbidden',
  UNSAFE_CUTOVER_OUTPUT: 'unsafe_cutover_output',
});

const POLICY_LIBRARY_REBUILD_CUTOVER_STAGE_IDS = Object.freeze({
  CUTOVER: 'cutover',
  VERIFICATION: 'verification',
  ROLLBACK_SNAPSHOT: 'rollback_snapshot',
  REPLACEMENT: 'replacement',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const SUCCESS_STATUS_IDS = new Set([
  POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.CUTOVER_APPLIED,
  POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.ALREADY_APPLIED,
]);
const ALLOWED_CHECKPOINTS = Object.freeze({
  verification: new Set(['existing_receipt', 'persisted', 'replayed', 'not_attempted']),
  rollbackSnapshot: new Set(['persisted', 'reused', 'not_persisted']),
  replacement: new Set(['applied', 'reused', 'not_applied']),
});
const FORBIDDEN_OUTPUT_KEYS = new Set([
  'proposal',
  'transition',
  'verifierReport',
  'representativeClassifications',
  'sourceResult',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeString(value, maximumLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function normalizeIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeFingerprint(value) {
  const fingerprint = normalizeString(value, 64);
  return SHA256_FINGERPRINT_PATTERN.test(fingerprint) ? fingerprint : null;
}

function summarizeExecution(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const execution = asObject(value);

  return {
    gateId: normalizePositiveInteger(execution.gateId),
    policyId: normalizePositiveInteger(execution.policyId),
    originalIntentId: normalizePositiveInteger(execution.originalIntentId),
    replacementIntentId: normalizePositiveInteger(execution.replacementIntentId),
    replacementEventId: normalizePositiveInteger(execution.replacementEventId),
    rollbackSnapshotId: normalizePositiveInteger(execution.rollbackSnapshotId),
    verificationRunId: normalizePositiveInteger(execution.verificationRunId),
    transitionFingerprint: normalizeFingerprint(execution.transitionFingerprint),
    proposalFingerprint: normalizeFingerprint(execution.proposalFingerprint),
    verificationRunFingerprint: normalizeFingerprint(execution.verificationRunFingerprint),
    verificationRunStatusId: normalizeString(execution.verificationRunStatusId) || null,
    appliedAt: normalizeIsoDate(execution.appliedAt),
    idempotent: execution.idempotent === true,
  };
}

function buildCheckpoints(value = {}) {
  const checkpoints = asObject(value);

  return {
    verification: ALLOWED_CHECKPOINTS.verification.has(checkpoints.verification)
      ? checkpoints.verification
      : 'not_attempted',
    rollbackSnapshot: ALLOWED_CHECKPOINTS.rollbackSnapshot.has(checkpoints.rollbackSnapshot)
      ? checkpoints.rollbackSnapshot
      : 'not_persisted',
    replacement: ALLOWED_CHECKPOINTS.replacement.has(checkpoints.replacement)
      ? checkpoints.replacement
      : 'not_applied',
  };
}

function buildStop(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const stop = asObject(value);
  const stageId = normalizeString(stop.stageId, 60);
  const reasonId = normalizeString(stop.reasonId, 120);

  if (!Object.values(POLICY_LIBRARY_REBUILD_CUTOVER_STAGE_IDS).includes(stageId) || !reasonId) {
    return null;
  }

  return { stageId, reasonId };
}

function buildPolicyLibraryRebuildCutoverResult({
  statusId,
  now = new Date(),
  execution = null,
  checkpoints = {},
  stop = null,
} = {}) {
  const normalizedStatusId = Object.values(POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS)
    .includes(statusId)
    ? statusId
    : POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.FAILED;
  const resultCheckpoints = buildCheckpoints(checkpoints);
  const applied = normalizedStatusId === POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.CUTOVER_APPLIED;
  const alreadyApplied = normalizedStatusId === POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.ALREADY_APPLIED;

  return {
    version: POLICY_LIBRARY_REBUILD_CUTOVER_VERSION,
    statusId: normalizedStatusId,
    ok: SUCCESS_STATUS_IDS.has(normalizedStatusId),
    evaluatedAt: normalizeIsoDate(now),
    execution: summarizeExecution(execution),
    checkpoints: resultCheckpoints,
    stop: SUCCESS_STATUS_IDS.has(normalizedStatusId) ? null : buildStop(stop),
    sideEffects: {
      verificationReceiptPersisted: resultCheckpoints.verification === 'persisted',
      rollbackSnapshotCreated: resultCheckpoints.rollbackSnapshot === 'persisted',
      replacementApplied: applied,
      routingWritten: applied,
      policyDeleted: false,
      legacyDeletionAuthorized: false,
      browserControlsRendered: false,
      idempotentReplay: alreadyApplied,
    },
  };
}

function buildPolicyLibraryRebuildCutoverAudit(result = {}) {
  const validation = validatePolicyLibraryRebuildCutoverResult(result);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: normalizeString(asObject(result).statusId) || null,
    legacyDeletionAuthorized: asObject(asObject(result).sideEffects).legacyDeletionAuthorized === true,
    validation,
    nextStep: {
      stepId: 'library_rebuild_legacy_deletion_readiness_gate',
      label: 'Library Rebuild Legacy-Path Deletion Readiness Gate',
      reason: 'Native cutover must prove explicit removal readiness before any legacy policy path can be deleted.',
    },
  };
}

function validatePolicyLibraryRebuildCutoverResult(result = {}) {
  const cutover = asObject(result);
  const execution = asObject(cutover.execution);
  const checkpoints = asObject(cutover.checkpoints);
  const sideEffects = asObject(cutover.sideEffects);
  const statusId = normalizeString(cutover.statusId);
  const succeeded = SUCCESS_STATUS_IDS.has(statusId);
  const issues = [];

  if (cutover.version !== POLICY_LIBRARY_REBUILD_CUTOVER_VERSION ||
      !Object.values(POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS).includes(statusId) ||
      !normalizeIsoDate(cutover.evaluatedAt)) {
    issues.push({ riskId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_CUTOVER_OUTPUT });
  }

  if (cutover.ok !== succeeded ||
      !ALLOWED_CHECKPOINTS.verification.has(checkpoints.verification) ||
      !ALLOWED_CHECKPOINTS.rollbackSnapshot.has(checkpoints.rollbackSnapshot) ||
      !ALLOWED_CHECKPOINTS.replacement.has(checkpoints.replacement)) {
    issues.push({ riskId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_CUTOVER_OUTPUT });
  }

  if (succeeded && (!Number.isInteger(execution.gateId) ||
      !Number.isInteger(execution.policyId) ||
      !Number.isInteger(execution.originalIntentId) ||
      !Number.isInteger(execution.replacementIntentId) ||
      !Number.isInteger(execution.replacementEventId) ||
      !Number.isInteger(execution.rollbackSnapshotId) ||
      !Number.isInteger(execution.verificationRunId) ||
      !SHA256_FINGERPRINT_PATTERN.test(execution.transitionFingerprint || '') ||
      !SHA256_FINGERPRINT_PATTERN.test(execution.proposalFingerprint || '') ||
      !SHA256_FINGERPRINT_PATTERN.test(execution.verificationRunFingerprint || '') ||
      execution.verificationRunStatusId !== 'no_migration_differences' ||
      !normalizeIsoDate(execution.appliedAt))) {
    issues.push({ riskId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_CUTOVER_OUTPUT });
  }

  if ((succeeded && cutover.stop !== null) || (!succeeded && !buildStop(cutover.stop))) {
    issues.push({ riskId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_CUTOVER_OUTPUT });
  }

  if (sideEffects.policyDeleted === true ||
      sideEffects.legacyDeletionAuthorized === true ||
      sideEffects.browserControlsRendered === true ||
      (sideEffects.routingWritten === true && sideEffects.replacementApplied !== true) ||
      (statusId !== POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.CUTOVER_APPLIED &&
        (sideEffects.replacementApplied === true || sideEffects.routingWritten === true))) {
    issues.push({ riskId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.LEGACY_DELETION_FORBIDDEN });
  }

  if (Object.keys(cutover).some(key => FORBIDDEN_OUTPUT_KEYS.has(key))) {
    issues.push({ riskId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_CUTOVER_OUTPUT });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS,
  POLICY_LIBRARY_REBUILD_CUTOVER_STAGE_IDS,
  POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_CUTOVER_VERSION,
  buildPolicyLibraryRebuildCutoverAudit,
  buildPolicyLibraryRebuildCutoverResult,
  validatePolicyLibraryRebuildCutoverResult,
};
