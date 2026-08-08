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

const POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_VERSION =
  'policy.storage_completion_checkpoint_artifact_fingerprint.v1';

const POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS =
  Object.freeze({
    MISSING_ARTIFACT: 'missing_artifact',
    MISSING_FINGERPRINT: 'missing_fingerprint',
    MALFORMED_FINGERPRINT: 'malformed_fingerprint',
    FINGERPRINT_MISMATCH: 'fingerprint_mismatch',
    PROVENANCE_MISMATCH: 'provenance_mismatch',
  });

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

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

function normalizeRisks(risks = []) {
  return asArray(risks)
    .map(risk => stableValue(asObject(risk)))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function buildPolicyStorageCompletionCheckpointArtifactProjection(artifact = {}) {
  const value = asObject(artifact);

  return {
    version: POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_VERSION,
    artifact: {
      version: value.version || null,
      generatedAt: value.generatedAt || null,
      statusId: value.statusId || null,
      complete: value.complete === true,
      componentEvidence: stableValue(asArray(value.componentEvidence)),
      componentScopeMap: stableValue(asObject(value.componentScopeMap)),
      roadmapEvidence: stableValue(asObject(value.roadmapEvidence)),
      completionAuditArtifact: stableValue(asObject(value.completionAuditArtifact)),
      validationEvidence: stableValue(asObject(value.validationEvidence)),
      changelogEvidence: stableValue(asObject(value.changelogEvidence)),
      checkpoint: stableValue(asObject(value.checkpoint)),
      checkpointSummary: stableValue(asObject(value.checkpointSummary)),
      completionAuditArtifactSummary: stableValue(
        asObject(value.completionAuditArtifactSummary)
      ),
      riskCount: value.riskCount ?? null,
      risks: normalizeRisks(value.risks),
      sideEffects: stableValue(asObject(value.sideEffects)),
      executionPolicy: stableValue(asObject(value.executionPolicy)),
      nextStep: stableValue(asObject(value.nextStep)),
    },
  };
}

function buildPolicyStorageCompletionCheckpointArtifactFingerprint({ artifact = {} } = {}) {
  const projection = buildPolicyStorageCompletionCheckpointArtifactProjection(artifact);
  const fingerprint = createHash('sha256')
    .update(stableStringify(projection))
    .digest('hex');

  return {
    version: POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    fingerprint,
    provenance: {
      artifactVersion: projection.artifact.version,
      generatedAt: projection.artifact.generatedAt,
      statusId: projection.artifact.statusId,
      complete: projection.artifact.complete,
      componentEvidenceCount: projection.artifact.componentEvidence.length,
      roadmapSequenceCount:
        asArray(projection.artifact.roadmapEvidence.componentSequenceIds).length,
      completionAuditArtifactFingerprint:
        projection.artifact.completionAuditArtifact.artifactFingerprint?.fingerprint || null,
      validationEvidenceArtifactFingerprint:
        projection.artifact.validationEvidence.artifactFingerprint?.fingerprint || null,
      checkpointStatusId: projection.artifact.checkpoint.statusId || null,
    },
  };
}

function validatePolicyStorageCompletionCheckpointArtifactFingerprint({
  artifact = null,
  artifactFingerprint = null,
} = {}) {
  const issues = [];

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    issues.push({
      riskId:
        POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS.MISSING_ARTIFACT,
      message: 'Checkpoint artifact fingerprint validation requires an artifact object.',
    });
  }

  if (
    !artifactFingerprint ||
    typeof artifactFingerprint !== 'object' ||
    Array.isArray(artifactFingerprint)
  ) {
    issues.push({
      riskId:
        POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS
          .MISSING_FINGERPRINT,
      message: 'Checkpoint artifact fingerprint validation requires a fingerprint object.',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issueCount: issues.length, issues };
  }

  const expected = buildPolicyStorageCompletionCheckpointArtifactFingerprint({ artifact });
  const actualFingerprint = String(artifactFingerprint.fingerprint || '')
    .trim()
    .toLowerCase();

  if (
    artifactFingerprint.version !==
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_VERSION ||
    artifactFingerprint.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(actualFingerprint)
  ) {
    issues.push({
      riskId:
        POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS
          .MALFORMED_FINGERPRINT,
      message: 'Checkpoint artifact fingerprint must be a versioned SHA-256 hex digest.',
    });
  }

  if (actualFingerprint && actualFingerprint !== expected.fingerprint) {
    issues.push({
      riskId:
        POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS
          .FINGERPRINT_MISMATCH,
      message: 'Checkpoint artifact fingerprint must match its exact bounded artifact projection.',
    });
  }

  const provenance = asObject(artifactFingerprint.provenance);
  if (
    provenance.artifactVersion !== expected.provenance.artifactVersion ||
    provenance.generatedAt !== expected.provenance.generatedAt ||
    provenance.statusId !== expected.provenance.statusId ||
    provenance.complete !== expected.provenance.complete ||
    Number(provenance.componentEvidenceCount) !==
      Number(expected.provenance.componentEvidenceCount) ||
    Number(provenance.roadmapSequenceCount) !==
      Number(expected.provenance.roadmapSequenceCount) ||
    provenance.completionAuditArtifactFingerprint !==
      expected.provenance.completionAuditArtifactFingerprint ||
    provenance.validationEvidenceArtifactFingerprint !==
      expected.provenance.validationEvidenceArtifactFingerprint ||
    provenance.checkpointStatusId !== expected.provenance.checkpointStatusId
  ) {
    issues.push({
      riskId:
        POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS
          .PROVENANCE_MISMATCH,
      message: 'Checkpoint artifact fingerprint provenance must match the bounded projection.',
    });
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_VERSION,
  buildPolicyStorageCompletionCheckpointArtifactFingerprint,
  buildPolicyStorageCompletionCheckpointArtifactProjection,
  validatePolicyStorageCompletionCheckpointArtifactFingerprint,
};
