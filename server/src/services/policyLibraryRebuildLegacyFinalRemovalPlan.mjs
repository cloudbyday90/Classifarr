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
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_VERSION,
  validatePolicyLibraryRebuildLegacyDeletionReadiness,
} from './policyLibraryRebuildLegacyDeletionReadiness.mjs';
import {
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION,
  validatePolicyLibraryRebuildLegacyRemovalInventory,
} from './policyLibraryRebuildLegacyRemovalInventory.mjs';

const POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_VERSION =
  'policy.library_rebuild_legacy_final_removal_plan.v1';

const POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS = Object.freeze({
  READY_FOR_GLOBAL_RELEASE_RETIREMENT_GATE: 'ready_for_global_release_retirement_gate',
  BLOCKED_BY_EVIDENCE_BOUNDARY: 'blocked_by_evidence_boundary',
  BLOCKED_BY_READINESS: 'blocked_by_readiness',
  BLOCKED_BY_FRESHNESS: 'blocked_by_freshness',
  BLOCKED_BY_REMOVAL_INVENTORY: 'blocked_by_removal_inventory',
});

const POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS = Object.freeze({
  EVIDENCE_BOUNDARY_UNAVAILABLE: 'evidence_boundary_unavailable',
  READINESS_MISSING: 'readiness_missing',
  READINESS_VERSION_INVALID: 'readiness_version_invalid',
  READINESS_VALIDATION_INVALID: 'readiness_validation_invalid',
  READINESS_NOT_READY: 'readiness_not_ready',
  READINESS_TIMESTAMP_INVALID: 'readiness_timestamp_invalid',
  READINESS_TIMESTAMP_FUTURE: 'readiness_timestamp_future',
  READINESS_TIMESTAMP_STALE: 'readiness_timestamp_stale',
  REMOVAL_INVENTORY_INVALID: 'removal_inventory_invalid',
  REMOVAL_INVENTORY_MISMATCH: 'removal_inventory_mismatch',
  UNSAFE_PLAN_OUTPUT: 'unsafe_plan_output',
});

const MAX_READINESS_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 60 * 1000;
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

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

function normalizeFingerprint(value) {
  const fingerprint = normalizeString(value, 64);
  return SHA256_FINGERPRINT_PATTERN.test(fingerprint) ? fingerprint : null;
}

function normalizeIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function pushRisk(risks, riskId) {
  if (!risks.some(risk => risk.riskId === riskId)) {
    risks.push({ riskId });
  }
}

function summarizeReadiness(value = {}) {
  const readiness = asObject(value);
  const policy = asObject(readiness.policy);
  const cutover = asObject(readiness.cutover);
  const verification = asObject(readiness.verification);
  const rollback = asObject(readiness.rollback);
  const authority = asObject(readiness.runtimeAuthority);
  const inventory = asObject(readiness.removalInventory);

  return {
    version: normalizeString(readiness.version),
    statusId: normalizeString(readiness.statusId),
    evaluatedAt: normalizeIsoDate(readiness.evaluatedAt),
    readyForFinalRemovalAudit: readiness.readyForFinalRemovalAudit === true,
    validationOk: readiness.validation?.ok === true,
    policy: {
      policyId: normalizePositiveInteger(policy.policyId),
      libraryId: normalizePositiveInteger(policy.libraryId),
    },
    cutover: {
      gateId: normalizePositiveInteger(cutover.gateId),
      originalIntentId: normalizePositiveInteger(cutover.originalIntentId),
      replacementIntentId: normalizePositiveInteger(cutover.replacementIntentId),
      replacementEventId: normalizePositiveInteger(cutover.replacementEventId),
      transitionFingerprint: normalizeFingerprint(cutover.transitionFingerprint),
      proposalFingerprint: normalizeFingerprint(cutover.proposalFingerprint),
      appliedAt: normalizeIsoDate(cutover.appliedAt),
    },
    verification: {
      verificationRunId: normalizePositiveInteger(verification.verificationRunId),
      verifierFingerprint: normalizeFingerprint(verification.verifierFingerprint),
      verifierStatusId: normalizeString(verification.verifierStatusId),
    },
    rollback: {
      rollbackSnapshotId: normalizePositiveInteger(rollback.rollbackSnapshotId),
      dispositionId: normalizeString(rollback.dispositionId),
      expiresAt: normalizeIsoDate(rollback.expiresAt),
    },
    runtimeAuthority: {
      activeNativeIntentCount: Number.isInteger(authority.activeNativeIntentCount)
        ? authority.activeNativeIntentCount
        : null,
      activeNativeIntentId: normalizePositiveInteger(authority.activeNativeIntentId),
    },
    removalInventory: {
      version: normalizeString(inventory.version),
      statusId: normalizeString(inventory.statusId),
      candidateCount: Number.isInteger(inventory.candidateCount)
        ? inventory.candidateCount
        : null,
      inventoryFingerprint: normalizeFingerprint(inventory.inventoryFingerprint),
      validationOk: inventory.validationOk === true,
    },
  };
}

function summarizeRemovalInventory(value = {}) {
  const inventory = asObject(value);

  return {
    version: normalizeString(inventory.version),
    statusId: normalizeString(inventory.statusId),
    candidateCount: Number.isInteger(inventory.candidateCount)
      ? inventory.candidateCount
      : null,
    inventoryFingerprint: normalizeFingerprint(inventory.inventoryFingerprint),
    validationOk: inventory.validation?.ok === true,
  };
}

function determineStatusId(risks) {
  if (risks.some(risk => risk.riskId ===
    POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.EVIDENCE_BOUNDARY_UNAVAILABLE)) {
    return POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY;
  }

  if (risks.some(risk => [
    POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.READINESS_TIMESTAMP_INVALID,
    POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.READINESS_TIMESTAMP_FUTURE,
    POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.READINESS_TIMESTAMP_STALE,
  ].includes(risk.riskId))) {
    return POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS.BLOCKED_BY_FRESHNESS;
  }

  if (risks.some(risk => [
    POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.REMOVAL_INVENTORY_INVALID,
    POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.REMOVAL_INVENTORY_MISMATCH,
  ].includes(risk.riskId))) {
    return POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS
      .BLOCKED_BY_REMOVAL_INVENTORY;
  }

  if (risks.length > 0) {
    return POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS.BLOCKED_BY_READINESS;
  }

  return POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS
    .READY_FOR_GLOBAL_RELEASE_RETIREMENT_GATE;
}

function buildPolicyLibraryRebuildLegacyFinalRemovalPlan({
  readiness = null,
  removalInventory = null,
  evidenceBoundaryAvailable = true,
  now = new Date(),
} = {}) {
  const evaluatedAt = normalizeIsoDate(now) || new Date().toISOString();
  const executionTime = new Date(evaluatedAt);
  const summarizedReadiness = summarizeReadiness(readiness);
  const summarizedInventory = summarizeRemovalInventory(removalInventory);
  const readinessValidation = validatePolicyLibraryRebuildLegacyDeletionReadiness(readiness);
  const inventoryValidation = validatePolicyLibraryRebuildLegacyRemovalInventory(removalInventory);
  const risks = [];

  if (evidenceBoundaryAvailable !== true) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS
      .EVIDENCE_BOUNDARY_UNAVAILABLE);
  }

  if (!readiness || !Object.keys(asObject(readiness)).length) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.READINESS_MISSING);
  } else if (summarizedReadiness.version !== POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_VERSION) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS
      .READINESS_VERSION_INVALID);
  } else if (!readinessValidation.ok || summarizedReadiness.validationOk !== true) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS
      .READINESS_VALIDATION_INVALID);
  } else if (summarizedReadiness.statusId !==
      POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.READY_FOR_FINAL_REMOVAL_AUDIT ||
      summarizedReadiness.readyForFinalRemovalAudit !== true) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.READINESS_NOT_READY);
  }

  if (!summarizedReadiness.evaluatedAt) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS
      .READINESS_TIMESTAMP_INVALID);
  } else {
    const ageMs = executionTime.getTime() - new Date(summarizedReadiness.evaluatedAt).getTime();
    if (ageMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
      pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS
        .READINESS_TIMESTAMP_FUTURE);
    } else if (ageMs > MAX_READINESS_AGE_MS) {
      pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS
        .READINESS_TIMESTAMP_STALE);
    }
  }

  if (summarizedInventory.version !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION ||
      summarizedInventory.statusId !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.READY ||
      summarizedInventory.candidateCount === null || summarizedInventory.candidateCount < 1 ||
      !summarizedInventory.inventoryFingerprint || summarizedInventory.validationOk !== true ||
      !inventoryValidation.ok) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS
      .REMOVAL_INVENTORY_INVALID);
  }

  if (summarizedReadiness.removalInventory.version !== summarizedInventory.version ||
      summarizedReadiness.removalInventory.statusId !== summarizedInventory.statusId ||
      summarizedReadiness.removalInventory.candidateCount !== summarizedInventory.candidateCount ||
      summarizedReadiness.removalInventory.inventoryFingerprint !==
        summarizedInventory.inventoryFingerprint ||
      summarizedReadiness.removalInventory.validationOk !== true) {
    pushRisk(risks, POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS
      .REMOVAL_INVENTORY_MISMATCH);
  }

  const statusId = determineStatusId(risks);
  const readyForGlobalReleaseRetirementGate = statusId ===
    POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS
      .READY_FOR_GLOBAL_RELEASE_RETIREMENT_GATE;
  const plan = {
    version: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_VERSION,
    statusId,
    evaluatedAt,
    readyForGlobalReleaseRetirementGate,
    policy: summarizedReadiness.policy,
    cutover: summarizedReadiness.cutover,
    verification: summarizedReadiness.verification,
    rollback: summarizedReadiness.rollback,
    runtimeAuthority: summarizedReadiness.runtimeAuthority,
    removalInventory: summarizedInventory,
    plan: {
      planKindId: 'global_release_legacy_path_retirement',
      candidateCount: summarizedInventory.candidateCount,
      inventoryFingerprint: summarizedInventory.inventoryFingerprint,
      candidatePathsExposed: false,
      executionAuthorized: false,
      repositoryMutationAuthorized: false,
      runtimeDeletionAuthorized: false,
      requiresGlobalReleaseDecision: true,
    },
    riskCount: risks.length,
    risks,
    sideEffects: {
      databaseRead: false,
      finalRemovalPlanPersisted: false,
      legacyPathsDeleted: false,
      legacyPathsHidden: false,
      legacyPathsArchived: false,
      routingWritten: false,
      browserControlsRendered: false,
    },
    nextStep: readyForGlobalReleaseRetirementGate
      ? {
        stepId: 'library_rebuild_legacy_path_global_release_retirement_gate',
        label: 'Library Rebuild Legacy-Path Global Release Retirement Gate',
      }
      : {
        stepId: 'library_rebuild_legacy_path_final_removal_audit_recheck',
        label: 'Recheck Library Rebuild Legacy-Path Final-Removal Audit',
      },
  };

  return {
    ...plan,
    validation: validatePolicyLibraryRebuildLegacyFinalRemovalPlan(plan),
  };
}

function validatePolicyLibraryRebuildLegacyFinalRemovalPlan(plan = {}) {
  const result = asObject(plan);
  const risks = asArray(result.risks);
  const sideEffects = asObject(result.sideEffects);
  const expectedStatusId = determineStatusId(risks);
  const ready = expectedStatusId === POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS
    .READY_FOR_GLOBAL_RELEASE_RETIREMENT_GATE;
  const issues = [];

  if (result.version !== POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_VERSION ||
      !Object.values(POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS)
        .includes(result.statusId) ||
      !normalizeIsoDate(result.evaluatedAt) || result.riskCount !== risks.length ||
      result.statusId !== expectedStatusId ||
      result.readyForGlobalReleaseRetirementGate !== ready) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.UNSAFE_PLAN_OUTPUT,
    });
  }

  if (sideEffects.finalRemovalPlanPersisted !== false || sideEffects.legacyPathsDeleted !== false ||
      sideEffects.legacyPathsHidden !== false || sideEffects.legacyPathsArchived !== false ||
      sideEffects.routingWritten !== false || sideEffects.browserControlsRendered !== false ||
      result.plan?.candidatePathsExposed !== false || result.plan?.executionAuthorized !== false ||
      result.plan?.repositoryMutationAuthorized !== false || result.plan?.runtimeDeletionAuthorized !== false ||
      result.plan?.requiresGlobalReleaseDecision !== true || Object.hasOwn(result, 'readiness') ||
      Object.hasOwn(result, 'artifacts') || Object.hasOwn(result, 'candidates')) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.UNSAFE_PLAN_OUTPUT,
    });
  }

  if (ready && (!result.policy?.policyId || !result.policy?.libraryId ||
      !result.cutover?.gateId || !result.cutover?.originalIntentId ||
      !result.cutover?.replacementIntentId || !result.cutover?.replacementEventId ||
      !SHA256_FINGERPRINT_PATTERN.test(result.cutover?.transitionFingerprint || '') ||
      !SHA256_FINGERPRINT_PATTERN.test(result.cutover?.proposalFingerprint || '') ||
      !normalizeIsoDate(result.cutover?.appliedAt) || !result.verification?.verificationRunId ||
      !SHA256_FINGERPRINT_PATTERN.test(result.verification?.verifierFingerprint || '') ||
      result.verification?.verifierStatusId !== 'no_migration_differences' ||
      !result.rollback?.rollbackSnapshotId ||
      result.rollback?.dispositionId !== POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS
        .WINDOW_CLOSED_PAYLOAD_REDACTED ||
      !normalizeIsoDate(result.rollback?.expiresAt) ||
      result.runtimeAuthority?.activeNativeIntentCount !== 1 ||
      result.runtimeAuthority?.activeNativeIntentId !== result.cutover?.replacementIntentId ||
      result.removalInventory?.version !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_VERSION ||
      result.removalInventory?.statusId !== POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS
        .READY ||
      result.removalInventory?.candidateCount < 1 ||
      result.removalInventory?.validationOk !== true ||
      !SHA256_FINGERPRINT_PATTERN.test(result.removalInventory?.inventoryFingerprint || '') ||
      result.plan?.planKindId !== 'global_release_legacy_path_retirement' ||
      result.plan?.candidateCount !== result.removalInventory?.candidateCount ||
      result.plan?.inventoryFingerprint !== result.removalInventory?.inventoryFingerprint)) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.UNSAFE_PLAN_OUTPUT,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyLibraryRebuildLegacyFinalRemovalPlanAudit(plan = {}) {
  const validation = validatePolicyLibraryRebuildLegacyFinalRemovalPlan(plan);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: normalizeString(asObject(plan).statusId) || null,
    readyForGlobalReleaseRetirementGate:
      asObject(plan).readyForGlobalReleaseRetirementGate === true,
    legacyDeletionAuthorized: false,
    repositoryMutationAuthorized: false,
    runtimeDeletionAuthorized: false,
    validation,
    nextStep: {
      stepId: 'library_rebuild_legacy_path_global_release_retirement_gate',
      label: 'Library Rebuild Legacy-Path Global Release Retirement Gate',
      reason: 'A per-library audit cannot authorize repository or runtime deletion.',
    },
  };
}

export {
  MAX_READINESS_AGE_MS,
  POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_VERSION,
  buildPolicyLibraryRebuildLegacyFinalRemovalPlan,
  buildPolicyLibraryRebuildLegacyFinalRemovalPlanAudit,
  validatePolicyLibraryRebuildLegacyFinalRemovalPlan,
};
