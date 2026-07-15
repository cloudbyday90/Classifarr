/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'node:path';

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
  validatePolicyCompatibilityDeletionExecutionPlanArtifact,
} from './policyCompatibilityDeletionExecutionPlanArtifact.mjs';
import {
  validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from './policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
  validatePolicyCompatibilityDeletionExecutionPlan,
} from './policyCompatibilityDeletionExecutionPlan.mjs';

const POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_VERSION =
  'policy.storage_closure_execution_plan_source.v1';

const POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS = Object.freeze({
  ARTIFACT_NOT_READY: 'artifact_not_ready',
  ARTIFACT_VALIDATION_FAILED: 'artifact_validation_failed',
  ARTIFACT_FINGERPRINT_INVALID: 'artifact_fingerprint_invalid',
  EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
  EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
  MANIFEST_NOT_APPROVED: 'manifest_not_approved',
  MANIFEST_APPROVER_MISSING: 'manifest_approver_missing',
  MANIFEST_ENTRY_COUNT_MISMATCH: 'manifest_entry_count_mismatch',
  MANIFEST_ENTRY_NOT_READY: 'manifest_entry_not_ready',
  MANIFEST_PATH_INVALID: 'manifest_path_invalid',
  MANIFEST_PATH_DUPLICATE: 'manifest_path_duplicate',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeRepositoryPath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function isSafeRepositoryPath(value = '') {
  const normalizedPath = normalizeRepositoryPath(value);

  if (
    !normalizedPath ||
    normalizedPath.includes('\0') ||
    path.posix.isAbsolute(normalizedPath) ||
    path.win32.isAbsolute(normalizedPath) ||
    path.posix.normalize(normalizedPath) !== normalizedPath
  ) {
    return false;
  }

  return normalizedPath.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}

function evaluateManifest(executionPlan = {}) {
  const manifest = asObject(executionPlan.manifest);
  const entries = asArray(manifest.entries).map(entry => asObject(entry));
  const manifestPaths = [];
  const risks = [];
  const pathSet = new Set();

  if (manifest.approved !== true) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.MANIFEST_NOT_APPROVED,
      'Storage closure final-removal audit requires an explicitly approved execution-plan manifest.'
    ));
  }

  if (!String(manifest.approvedBy || '').trim()) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.MANIFEST_APPROVER_MISSING,
      'Storage closure final-removal audit requires manifest approver metadata.',
      { approvedBy: manifest.approvedBy || null }
    ));
  }

  if (Number(manifest.entryCount) !== entries.length) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.MANIFEST_ENTRY_COUNT_MISMATCH,
      'Execution-plan manifest entryCount must match the exact manifest entry list.',
      { entryCount: manifest.entryCount ?? null, actualEntryCount: entries.length }
    ));
  }

  entries.forEach((entry, index) => {
    const repositoryPath = normalizeRepositoryPath(entry.path);

    if (!isSafeRepositoryPath(repositoryPath)) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.MANIFEST_PATH_INVALID,
        'Execution-plan manifest paths must be canonical repository-relative paths.',
        { entryIndex: index, path: entry.path || null }
      ));
      return;
    }

    if (pathSet.has(repositoryPath)) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.MANIFEST_PATH_DUPLICATE,
        'Execution-plan manifest paths must be unique after normalization.',
        { entryIndex: index, path: repositoryPath }
      ));
      return;
    }

    pathSet.add(repositoryPath);
    manifestPaths.push(repositoryPath);

    if (entry.ready !== true) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.MANIFEST_ENTRY_NOT_READY,
        'Storage closure final-removal audit requires every approved manifest entry to be ready.',
        { entryIndex: index, path: repositoryPath }
      ));
    }
  });

  return { manifestPaths, risks };
}

function resolvePolicyStorageClosureExecutionPlanSource({ executionPlanArtifact = null } = {}) {
  const artifact = asObject(executionPlanArtifact);
  const executionPlan = asObject(artifact.executionPlan);
  const risks = [];
  const artifactValidation = validatePolicyCompatibilityDeletionExecutionPlanArtifact(artifact);
  const fingerprintValidation =
    validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact,
      artifactFingerprint: artifact.artifactFingerprint,
    });
  const executionPlanValidation = validatePolicyCompatibilityDeletionExecutionPlan(executionPlan);

  if (
    artifact.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION ||
    artifact.statusId !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY ||
    artifact.ready !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.ARTIFACT_NOT_READY,
      'Storage closure final-removal audit requires a ready versioned execution-plan artifact.',
      { version: artifact.version || null, statusId: artifact.statusId || null }
    ));
  }

  if (artifact.validation?.ok !== true || artifactValidation.ok !== true) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.ARTIFACT_VALIDATION_FAILED,
      'Storage closure final-removal audit requires valid execution-plan artifact invariants.',
      { issueCount: artifactValidation.issueCount }
    ));
  }

  if (!fingerprintValidation.ok) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.ARTIFACT_FINGERPRINT_INVALID,
      'Storage closure final-removal audit requires an intact execution-plan artifact fingerprint.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  if (
    executionPlan.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION ||
    executionPlan.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
    executionPlan.readyForExecutionGate !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.EXECUTION_PLAN_NOT_READY,
      'Storage closure final-removal audit requires the artifact to carry a ready execution plan.',
      { version: executionPlan.version || null, statusId: executionPlan.statusId || null }
    ));
  }

  if (executionPlan.validation?.ok !== true || executionPlanValidation.ok !== true) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.EXECUTION_PLAN_VALIDATION_FAILED,
      'Storage closure final-removal audit requires valid nested execution-plan invariants.',
      { issueCount: executionPlanValidation.issueCount }
    ));
  }

  const manifest = evaluateManifest(executionPlan);
  risks.push(...manifest.risks);

  const ok = risks.length === 0;

  return {
    version: POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_VERSION,
    statusId: ok
      ? POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_STATUS_IDS.READY
      : POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_STATUS_IDS.BLOCKED,
    ok,
    issueCount: risks.length,
    issues: risks,
    executionPlan: ok ? executionPlan : null,
    manifestPaths: ok ? manifest.manifestPaths : [],
    artifactFingerprint: artifact.artifactFingerprint?.fingerprint || null,
  };
}

export {
  POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS,
  POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_STATUS_IDS,
  POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_VERSION,
  isSafeRepositoryPath,
  resolvePolicyStorageClosureExecutionPlanSource,
};
