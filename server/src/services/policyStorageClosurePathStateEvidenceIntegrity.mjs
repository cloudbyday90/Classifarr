/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  buildPolicyStorageClosurePathStateEvidence,
  POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_STATUS_IDS,
  validatePolicyStorageClosurePathStateEvidence,
} from './policyStorageClosurePathStateEvidence.mjs';
import {
  buildPolicyStorageClosurePathStateEvidenceProjection,
  validatePolicyStorageClosurePathStateEvidenceFingerprint,
} from './policyStorageClosurePathStateEvidenceFingerprint.mjs';

const POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_VERSION =
  'policy.storage_closure_path_state_evidence_integrity.v1';

const POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_STATUS_IDS = Object.freeze({
  VERIFIED: 'verified',
  BLOCKED: 'blocked',
});

const POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_RISK_IDS = Object.freeze({
  EVIDENCE_NOT_CAPTURED: 'evidence_not_captured',
  EVIDENCE_VALIDATION_FAILED: 'evidence_validation_failed',
  EVIDENCE_FINGERPRINT_INVALID: 'evidence_fingerprint_invalid',
  EVIDENCE_REPLAY_MISMATCH: 'evidence_replay_mismatch',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
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

function buildPolicyStorageClosurePathStateEvidenceIntegrity({ evidence = null } = {}) {
  const value = asObject(evidence);
  const validation = validatePolicyStorageClosurePathStateEvidence(value);
  const fingerprintValidation = validatePolicyStorageClosurePathStateEvidenceFingerprint({
    evidence: value,
    artifactFingerprint: value.artifactFingerprint,
  });
  const replayedEvidence = buildPolicyStorageClosurePathStateEvidence({
    executionPlanArtifact: value.observationInput?.executionPlanArtifact,
    observations: value.observationInput?.observations,
    generatedAt: value.generatedAt,
    sideEffects: value.observationInput?.sideEffects,
  });
  const risks = [];

  if (
    value.statusId !== POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_STATUS_IDS.CAPTURED ||
    value.captured !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_RISK_IDS.EVIDENCE_NOT_CAPTURED,
      'Final-removal audit requires captured checkout path-state evidence.',
      { statusId: value.statusId || null }
    ));
  }

  if (!validation.ok) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_RISK_IDS.EVIDENCE_VALIDATION_FAILED,
      'Checkout path-state evidence must validate before final-removal audit can use it.',
      { issueCount: validation.issueCount }
    ));
  }

  if (!fingerprintValidation.ok) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_RISK_IDS.EVIDENCE_FINGERPRINT_INVALID,
      'Checkout path-state evidence must retain an intact deterministic fingerprint.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  if (
    stableStringify(buildPolicyStorageClosurePathStateEvidenceProjection(value)) !==
    stableStringify(buildPolicyStorageClosurePathStateEvidenceProjection(replayedEvidence))
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_RISK_IDS.EVIDENCE_REPLAY_MISMATCH,
      'Checkout path-state evidence must replay exactly from its retained artifact and observations.'
    ));
  }

  const ok = risks.length === 0;

  return {
    version: POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_VERSION,
    statusId: ok
      ? POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_STATUS_IDS.VERIFIED
      : POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_STATUS_IDS.BLOCKED,
    ok,
    issueCount: risks.length,
    issues: risks,
    replayedEvidence: ok ? replayedEvidence : null,
  };
}

export {
  POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_RISK_IDS,
  POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_STATUS_IDS,
  POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_INTEGRITY_VERSION,
  buildPolicyStorageClosurePathStateEvidenceIntegrity,
};
