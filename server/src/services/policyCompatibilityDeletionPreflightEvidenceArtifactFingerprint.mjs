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

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_VERSION =
  'policy.compatibility_deletion_preflight_evidence_artifact_fingerprint.v2';

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_RISK_IDS =
  Object.freeze({
    FINGERPRINT_MISMATCH: 'fingerprint_mismatch',
    MALFORMED_FINGERPRINT: 'malformed_fingerprint',
    MISSING_ARTIFACT: 'missing_artifact',
    MISSING_FINGERPRINT: 'missing_fingerprint',
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

function buildPolicyCompatibilityDeletionPreflightEvidenceArtifactProjection(artifact = {}) {
  const value = asObject(artifact);
  const {
    artifactFingerprint: _artifactFingerprint,
    validation: _validation,
    ...boundedArtifact
  } = value;

  return {
    version: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_VERSION,
    artifact: stableValue(boundedArtifact),
  };
}

function buildPolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint({ artifact = {} } = {}) {
  const projection = buildPolicyCompatibilityDeletionPreflightEvidenceArtifactProjection(artifact);

  return {
    version: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    fingerprint: createHash('sha256')
      .update(stableStringify(projection))
      .digest('hex'),
    provenance: {
      artifactStatusId: projection.artifact.statusId || null,
      executionPlanArtifactFingerprint:
        projection.artifact.executionPlanArtifact?.fingerprint || null,
      generatedAt: projection.artifact.generatedAt || null,
      sourceRevision: projection.artifact.checkout?.sourceRevision || null,
    },
  };
}

function validatePolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint({
  artifact = null,
  artifactFingerprint = null,
} = {}) {
  const issues = [];

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_RISK_IDS
        .MISSING_ARTIFACT,
      message: 'Preflight evidence artifact fingerprint validation requires an artifact object.',
    });
  }
  if (
    !artifactFingerprint ||
    typeof artifactFingerprint !== 'object' ||
    Array.isArray(artifactFingerprint)
  ) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_RISK_IDS
        .MISSING_FINGERPRINT,
      message: 'Preflight evidence artifact fingerprint validation requires a fingerprint object.',
    });
  }
  if (issues.length > 0) {
    return { ok: false, issueCount: issues.length, issues };
  }

  const expected = buildPolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint({ artifact });
  const actualFingerprint = String(artifactFingerprint.fingerprint || '').trim().toLowerCase();

  if (
    artifactFingerprint.version !==
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_VERSION ||
    artifactFingerprint.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(actualFingerprint)
  ) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_RISK_IDS
        .MALFORMED_FINGERPRINT,
      message: 'Preflight evidence artifact fingerprint must be a versioned SHA-256 hex digest.',
    });
  }
  if (actualFingerprint && actualFingerprint !== expected.fingerprint) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_RISK_IDS
        .FINGERPRINT_MISMATCH,
      message: 'Preflight evidence artifact fingerprint must match the exact bounded observation projection.',
    });
  }

  const provenance = asObject(artifactFingerprint.provenance);
  if (
    provenance.artifactStatusId !== expected.provenance.artifactStatusId ||
    provenance.executionPlanArtifactFingerprint !==
      expected.provenance.executionPlanArtifactFingerprint ||
    provenance.generatedAt !== expected.provenance.generatedAt ||
    provenance.sourceRevision !== expected.provenance.sourceRevision
  ) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_RISK_IDS
        .FINGERPRINT_MISMATCH,
      message: 'Preflight evidence artifact fingerprint provenance must match the bounded observation projection.',
    });
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_FINGERPRINT_VERSION,
  buildPolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint,
  buildPolicyCompatibilityDeletionPreflightEvidenceArtifactProjection,
  validatePolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint,
};
