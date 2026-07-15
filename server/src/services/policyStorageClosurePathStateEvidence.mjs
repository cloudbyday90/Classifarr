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
  buildPolicyStorageClosurePathStateEvidenceFingerprint,
  validatePolicyStorageClosurePathStateEvidenceFingerprint,
} from './policyStorageClosurePathStateEvidenceFingerprint.mjs';
import {
  resolvePolicyStorageClosureExecutionPlanSource,
} from './policyStorageClosureExecutionPlanSource.mjs';

const POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_VERSION =
  'policy.storage_closure_path_state_evidence.v1';

const POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_STATUS_IDS = Object.freeze({
  CAPTURED: 'captured',
  BLOCKED: 'blocked',
});

const POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS = Object.freeze({
  EXECUTION_PLAN_ARTIFACT_INVALID: 'execution_plan_artifact_invalid',
  EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISMATCH:
    'execution_plan_artifact_fingerprint_mismatch',
  OBSERVATION_PATH_INVALID: 'observation_path_invalid',
  OBSERVATION_PATH_UNKNOWN: 'observation_path_unknown',
  OBSERVATION_PATH_DUPLICATE: 'observation_path_duplicate',
  OBSERVATION_EXISTS_INVALID: 'observation_exists_invalid',
  OBSERVATION_PATH_MISSING: 'observation_path_missing',
  PATH_STATE_MISMATCH: 'path_state_mismatch',
  DERIVED_RISKS_MISMATCH: 'derived_risks_mismatch',
  SIDE_EFFECT_SUMMARY_MISMATCH: 'side_effect_summary_mismatch',
  FILE_READ_NOT_REPORTED: 'file_read_not_reported',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  UNKNOWN_VERSION: 'unknown_version',
  UNKNOWN_STATUS: 'unknown_status',
  CAPTURED_FLAG_MISMATCH: 'captured_flag_mismatch',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  ARTIFACT_FINGERPRINT_INVALID: 'artifact_fingerprint_invalid',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  return Object.keys(value)
    .filter(key => !['function', 'symbol', 'undefined'].includes(typeof value[key]))
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = stableValue(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function normalizeSideEffects(sideEffects = {}) {
  const value = asObject(sideEffects);

  return {
    filesRead: value.filesRead === true,
    filesWritten: value.filesWritten === true,
    filesDeleted: value.filesDeleted === true,
    filesArchived: value.filesArchived === true,
    storageChanged: value.storageChanged === true,
    manifestWritten: value.manifestWritten === true,
    gitCommandsRun: value.gitCommandsRun === true,
    commandsExecuted: value.commandsExecuted === true,
  };
}

function emptyPathState(manifestPaths = []) {
  const paths = asArray(manifestPaths).map(normalizePath).filter(Boolean).sort();

  return {
    manifestPaths: paths,
    existingPaths: [],
    removedPaths: [],
    totalCount: paths.length,
    existingCount: 0,
    removedCount: 0,
  };
}

function buildPathStateFromObservations({
  manifestPaths = [],
  observations = [],
} = {}) {
  const expectedPaths = asArray(manifestPaths).map(normalizePath).filter(Boolean).sort();
  const expectedPathSet = new Set(expectedPaths);
  const observationByPath = new Map();
  const risks = [];

  asArray(observations).forEach((observation, index) => {
    const value = asObject(observation);
    const rawPath = String(value.path || '');
    const path = normalizePath(rawPath);

    if (!path || rawPath !== path) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.OBSERVATION_PATH_INVALID,
        'Checkout path observations must use canonical repository-relative paths.',
        { observationIndex: index, path: value.path || null }
      ));
      return;
    }

    if (!expectedPathSet.has(path)) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.OBSERVATION_PATH_UNKNOWN,
        'Checkout path observations must not extend the approved execution-plan manifest.',
        { observationIndex: index, path }
      ));
      return;
    }

    if (observationByPath.has(path)) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.OBSERVATION_PATH_DUPLICATE,
        'Checkout path observations must contain one result for each approved manifest path.',
        { observationIndex: index, path }
      ));
      return;
    }

    if (typeof value.exists !== 'boolean') {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.OBSERVATION_EXISTS_INVALID,
        'Checkout path observations must record a boolean exists value.',
        { observationIndex: index, path }
      ));
      return;
    }

    observationByPath.set(path, value.exists);
  });

  expectedPaths.forEach(path => {
    if (!observationByPath.has(path)) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.OBSERVATION_PATH_MISSING,
        'Checkout path-state evidence must observe every approved manifest path.',
        { path }
      ));
    }
  });

  if (risks.length > 0) {
    return { pathState: emptyPathState(expectedPaths), risks };
  }

  const existingPaths = expectedPaths.filter(path => observationByPath.get(path) === true);
  const removedPaths = expectedPaths.filter(path => observationByPath.get(path) === false);

  return {
    pathState: {
      manifestPaths: expectedPaths,
      existingPaths,
      removedPaths,
      totalCount: expectedPaths.length,
      existingCount: existingPaths.length,
      removedCount: removedPaths.length,
    },
    risks,
  };
}

function buildEvidenceRisks({
  executionPlanSource = {},
  observations = [],
  sideEffects = {},
} = {}) {
  const risks = [];
  const source = asObject(executionPlanSource);
  const normalizedSideEffects = normalizeSideEffects(sideEffects);
  let pathState = emptyPathState();

  if (!source.ok) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.EXECUTION_PLAN_ARTIFACT_INVALID,
      'Checkout path-state evidence requires a ready fingerprint-valid execution-plan artifact source.',
      {
        issueCount: source.issueCount ?? null,
        issueRiskIds: asArray(source.issues).map(issue => issue.riskId),
      }
    ));
  } else {
    const observationState = buildPathStateFromObservations({
      manifestPaths: source.manifestPaths,
      observations,
    });
    pathState = observationState.pathState;
    risks.push(...observationState.risks);
  }

  if (!normalizedSideEffects.filesRead) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.FILE_READ_NOT_REPORTED,
      'Checkout path-state evidence must report the repository read used to capture path state.'
    ));
  }

  Object.entries(asObject(sideEffects)).forEach(([key, value]) => {
    if (key !== 'filesRead' && value === true) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Checkout path-state evidence cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return { pathState, risks, sideEffects: normalizedSideEffects };
}

function buildPolicyStorageClosurePathStateEvidence({
  executionPlanArtifact = null,
  observations = [],
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const executionPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
    executionPlanArtifact,
  });
  const evidenceResult = buildEvidenceRisks({
    executionPlanSource,
    observations,
    sideEffects,
  });
  const captured = evidenceResult.risks.length === 0;
  const evidence = {
    version: POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    statusId: captured
      ? POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_STATUS_IDS.CAPTURED
      : POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_STATUS_IDS.BLOCKED,
    captured,
    executionPlanArtifactFingerprint:
      executionPlanSource.artifactFingerprint || null,
    pathState: evidenceResult.pathState,
    observationInput: {
      executionPlanArtifact: asObject(executionPlanArtifact),
      observations: asArray(observations).map(observation => asObject(observation)),
      sideEffects: asObject(sideEffects),
    },
    riskCount: evidenceResult.risks.length,
    risks: evidenceResult.risks,
    sideEffects: evidenceResult.sideEffects,
  };
  const evidenceWithFingerprint = {
    ...evidence,
    artifactFingerprint: buildPolicyStorageClosurePathStateEvidenceFingerprint({ evidence }),
  };

  return {
    ...evidenceWithFingerprint,
    validation: validatePolicyStorageClosurePathStateEvidence(evidenceWithFingerprint),
  };
}

function validatePolicyStorageClosurePathStateEvidence(evidence = {}) {
  const value = asObject(evidence);
  const issues = [];
  const validStatusIds = Object.values(POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_STATUS_IDS);
  const observationInput = asObject(value.observationInput);
  const executionPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
    executionPlanArtifact: observationInput.executionPlanArtifact,
  });
  const evidenceResult = buildEvidenceRisks({
    executionPlanSource,
    observations: observationInput.observations,
    sideEffects: observationInput.sideEffects,
  });

  if (value.version !== POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_VERSION) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.UNKNOWN_VERSION,
      'Checkout path-state evidence version must be recognized.',
      { version: value.version || null }
    ));
  }

  if (!validStatusIds.includes(value.statusId)) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.UNKNOWN_STATUS,
      'Checkout path-state evidence status must be known.',
      { statusId: value.statusId || null }
    ));
  }

  if (value.riskCount !== asArray(value.risks).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.RISK_COUNT_MISMATCH,
      'Checkout path-state evidence risk count must match its risk list.',
      { riskCount: value.riskCount ?? null, actualRiskCount: asArray(value.risks).length }
    ));
  }

  const expectedCaptured = evidenceResult.risks.length === 0;
  if (
    value.captured !== expectedCaptured ||
    value.statusId !== (expectedCaptured
      ? POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_STATUS_IDS.CAPTURED
      : POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_STATUS_IDS.BLOCKED)
  ) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.CAPTURED_FLAG_MISMATCH,
      'Checkout path-state evidence captured state must match source and observation validity.',
      { expectedCaptured, receivedCaptured: value.captured === true }
    ));
  }

  if (value.executionPlanArtifactFingerprint !== executionPlanSource.artifactFingerprint) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISMATCH,
      'Checkout path-state evidence must remain bound to its embedded execution-plan artifact fingerprint.',
      {
        expectedFingerprint: executionPlanSource.artifactFingerprint || null,
        receivedFingerprint: value.executionPlanArtifactFingerprint || null,
      }
    ));
  }

  if (stableStringify(value.pathState) !== stableStringify(evidenceResult.pathState)) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.PATH_STATE_MISMATCH,
      'Checkout path-state evidence must match the retained bounded observations.',
      {
        expectedManifestPathCount: evidenceResult.pathState.totalCount,
        receivedManifestPathCount: value.pathState?.totalCount ?? null,
      }
    ));
  }

  if (stableStringify(asArray(value.risks)) !== stableStringify(evidenceResult.risks)) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.DERIVED_RISKS_MISMATCH,
      'Checkout path-state evidence risks must match the retained source and observations.',
      {
        expectedRiskCount: evidenceResult.risks.length,
        receivedRiskCount: asArray(value.risks).length,
      }
    ));
  }

  if (stableStringify(value.sideEffects) !== stableStringify(evidenceResult.sideEffects)) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.SIDE_EFFECT_SUMMARY_MISMATCH,
      'Checkout path-state evidence side-effect summary must match the retained observation input.',
      { expectedFilesRead: evidenceResult.sideEffects.filesRead }
    ));
  }

  const fingerprintValidation = validatePolicyStorageClosurePathStateEvidenceFingerprint({
    evidence: value,
    artifactFingerprint: value.artifactFingerprint,
  });
  if (!fingerprintValidation.ok) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.ARTIFACT_FINGERPRINT_INVALID,
      'Checkout path-state evidence fingerprint must bind the retained source and observations.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  Object.entries(asObject(value.sideEffects)).forEach(([key, sideEffect]) => {
    if (key !== 'filesRead' && sideEffect === true) {
      issues.push(buildRisk(
        POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Checkout path-state evidence cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_RISK_IDS,
  POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_STATUS_IDS,
  POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_VERSION,
  buildPathStateFromObservations,
  buildPolicyStorageClosurePathStateEvidence,
  validatePolicyStorageClosurePathStateEvidence,
};
