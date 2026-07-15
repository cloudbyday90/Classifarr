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
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_VERSION,
  buildPolicyStorageClosureValidationEvidence,
  validatePolicyStorageClosureValidationEvidence,
} from './policyStorageClosureValidationEvidence.mjs';

const POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_VERSION =
  'policy.storage_closure_validation_evidence_integrity.v1';

const POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS = Object.freeze({
  VALIDATION_EVIDENCE_MISSING: 'validation_evidence_missing',
  VALIDATION_EVIDENCE_INVALID: 'validation_evidence_invalid',
  VALIDATION_EVIDENCE_NOT_REPLAYABLE: 'validation_evidence_not_replayable',
  VALIDATION_EVIDENCE_REPLAY_MISMATCH: 'validation_evidence_replay_mismatch',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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
  return {
    riskId,
    message,
    ...metadata,
  };
}

function hasReplayInputs(evidence = {}) {
  const value = asObject(evidence);
  const validationInput = asObject(value.validationInput);

  return value.version === POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_VERSION &&
    typeof value.generatedAt === 'string' &&
    Array.isArray(value.commandCatalog) &&
    Array.isArray(validationInput.commandResults) &&
    validationInput.sideEffects &&
    typeof validationInput.sideEffects === 'object' &&
    !Array.isArray(validationInput.sideEffects);
}

function validatePolicyStorageClosureValidationEvidenceIntegrity({
  validationEvidence = null,
} = {}) {
  const risks = [];
  const evidence = asObject(validationEvidence);

  if (Object.keys(evidence).length === 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS
        .VALIDATION_EVIDENCE_MISSING,
      'Policy storage closure requires a validation evidence artifact.'
    ));
  }

  const evidenceValidation = validatePolicyStorageClosureValidationEvidence(evidence);
  if (
    evidence.version !== POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_VERSION ||
    evidence.validation?.ok !== true ||
    evidenceValidation.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS
        .VALIDATION_EVIDENCE_INVALID,
      'Policy storage closure requires a current fingerprint-valid validation evidence artifact.',
      {
        evidenceVersion: evidence.version || null,
        issueCount: evidenceValidation.issueCount,
        issueRiskIds: evidenceValidation.issues.map(issue => issue.riskId),
      }
    ));
  }

  if (!hasReplayInputs(evidence)) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS
        .VALIDATION_EVIDENCE_NOT_REPLAYABLE,
      'Policy storage closure validation evidence must retain normalized command results and side-effect input for deterministic verification.'
    ));
  }

  let replayedEvidence = null;
  if (risks.length === 0) {
    const validationInput = asObject(evidence.validationInput);
    replayedEvidence = buildPolicyStorageClosureValidationEvidence({
      commandResults: asArray(validationInput.commandResults),
      sideEffects: validationInput.sideEffects,
      generatedAt: evidence.generatedAt,
    });

    if (stableStringify(evidence) !== stableStringify(replayedEvidence)) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS
          .VALIDATION_EVIDENCE_REPLAY_MISMATCH,
        'Policy storage closure validation evidence does not match its retained normalized command results and side-effect input.',
        {
          evidenceStatusId: evidence.statusId || null,
          replayStatusId: replayedEvidence.statusId || null,
        }
      ));
    }
  }

  return {
    version: POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_VERSION,
    ok: risks.length === 0,
    issueCount: risks.length,
    issues: risks,
    validationEvidence: evidence,
    evidence: risks.length === 0 ? replayedEvidence : {},
    artifactFingerprint: evidence.artifactFingerprint?.fingerprint || null,
    policy: {
      requireCurrentFingerprintValidArtifact: true,
      requireRetainedValidationInputs: true,
      requireArtifactReplay: true,
      allowCommandExecutionInsideVerifier: false,
      allowStorageMutation: false,
      allowGitCommands: false,
      allowFileWrites: false,
    },
  };
}

export {
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS,
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_VERSION,
  validatePolicyStorageClosureValidationEvidenceIntegrity,
};
