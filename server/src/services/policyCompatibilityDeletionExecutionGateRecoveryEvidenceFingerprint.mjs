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

import { createHash } from 'node:crypto';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_VERSION =
  'policy.compatibility_deletion_execution_gate_recovery_evidence_fingerprint.v1';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_RISK_IDS =
  Object.freeze({
    MISSING_ARTIFACT: 'missing_artifact',
    MISSING_FINGERPRINT: 'missing_fingerprint',
    MALFORMED_FINGERPRINT: 'malformed_fingerprint',
    FINGERPRINT_MISMATCH: 'fingerprint_mismatch',
    PROVENANCE_MISMATCH: 'provenance_mismatch',
  });

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

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

function buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidenceProjection(evidence = {}) {
  const value = asObject(evidence);
  const {
    artifactFingerprint: _artifactFingerprint,
    validation: _validation,
    ...boundedEvidence
  } = value;

  return {
    version:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_VERSION,
    evidence: stableValue(boundedEvidence),
  };
}

function buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint({
  evidence = {},
} = {}) {
  const projection = buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidenceProjection(evidence);

  return {
    version:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    fingerprint: createHash('sha256')
      .update(stableStringify(projection))
      .digest('hex'),
    provenance: {
      evidenceVersion: projection.evidence.version || null,
      generatedAt: projection.evidence.generatedAt || null,
      statusId: projection.evidence.statusId || null,
      executionPlanArtifactFingerprint:
        projection.evidence.executionPlanArtifactFingerprint || null,
      backupRestoreEvidenceGeneratedAt:
        projection.evidence.backupRestoreVerificationEvidence?.generatedAt || null,
    },
  };
}

function validatePolicyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint({
  evidence = null,
  artifactFingerprint = null,
} = {}) {
  const issues = [];

  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    issues.push({
      riskId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_RISK_IDS
          .MISSING_ARTIFACT,
      message: 'Recovery evidence fingerprint validation requires an evidence artifact.',
    });
  }
  if (
    !artifactFingerprint ||
    typeof artifactFingerprint !== 'object' ||
    Array.isArray(artifactFingerprint)
  ) {
    issues.push({
      riskId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_RISK_IDS
          .MISSING_FINGERPRINT,
      message: 'Recovery evidence fingerprint validation requires a fingerprint object.',
    });
  }
  if (issues.length > 0) {
    return { ok: false, issueCount: issues.length, issues };
  }

  const expected = buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint({
    evidence,
  });
  const actualFingerprint = String(artifactFingerprint.fingerprint || '').trim().toLowerCase();

  if (
    artifactFingerprint.version !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_VERSION ||
    artifactFingerprint.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(actualFingerprint)
  ) {
    issues.push({
      riskId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_RISK_IDS
          .MALFORMED_FINGERPRINT,
      message: 'Recovery evidence fingerprint must be a versioned SHA-256 hex digest.',
    });
  }
  if (actualFingerprint && actualFingerprint !== expected.fingerprint) {
    issues.push({
      riskId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_RISK_IDS
          .FINGERPRINT_MISMATCH,
      message: 'Recovery evidence fingerprint must match the exact bounded recovery evidence.',
    });
  }

  const provenance = asObject(artifactFingerprint.provenance);
  if (
    provenance.evidenceVersion !== expected.provenance.evidenceVersion ||
    provenance.generatedAt !== expected.provenance.generatedAt ||
    provenance.statusId !== expected.provenance.statusId ||
    provenance.executionPlanArtifactFingerprint !==
      expected.provenance.executionPlanArtifactFingerprint ||
    provenance.backupRestoreEvidenceGeneratedAt !==
      expected.provenance.backupRestoreEvidenceGeneratedAt
  ) {
    issues.push({
      riskId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_RISK_IDS
          .PROVENANCE_MISMATCH,
      message: 'Recovery evidence fingerprint provenance must match its bounded evidence.',
    });
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_FINGERPRINT_VERSION,
  buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint,
  buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidenceProjection,
  validatePolicyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint,
};
