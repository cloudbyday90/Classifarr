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

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_VERSION =
  'policy.compatibility_deletion_execution_plan_artifact_fingerprint.v1';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS =
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

function normalizeManifestEntries(entries = []) {
  return asArray(entries)
    .map(entry => {
      const value = asObject(entry);

      return {
        actionId: value.actionId || null,
        categoryId: value.categoryId || null,
        deletionIntent: value.deletionIntent || null,
        path: value.path || null,
        ready: value.ready === true,
        replacementEvidence: value.replacementEvidence ?? null,
      };
    })
    .sort((left, right) => ['path', 'categoryId', 'actionId'].reduce((result, fieldName) => {
      if (result !== 0) return result;
      return String(left[fieldName] || '').localeCompare(String(right[fieldName] || ''));
    }, 0));
}

function normalizeRisks(risks = []) {
  return asArray(risks)
    .map(risk => stableValue(asObject(risk)))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function buildPolicyCompatibilityDeletionExecutionPlanArtifactProjection(artifact = {}) {
  const value = asObject(artifact);
  const evidenceBundle = asObject(value.evidenceBundle);
  const executionPlan = asObject(value.executionPlan);
  const manifest = asObject(executionPlan.manifest);

  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_VERSION,
    artifact: {
      version: value.version || null,
      generatedAt: value.generatedAt || null,
      statusId: value.statusId || null,
      ready: value.ready === true,
      riskCount: value.riskCount ?? null,
      risks: normalizeRisks(value.risks),
      sideEffects: stableValue(asObject(value.sideEffects)),
      evidenceBundle: {
        version: evidenceBundle.version || null,
        generatedAt: evidenceBundle.generatedAt || null,
        statusId: evidenceBundle.statusId || null,
        validationOk: evidenceBundle.validationOk === true,
      },
      executionPlan: {
        version: executionPlan.version || null,
        statusId: executionPlan.statusId || null,
        readyForExecutionGate: executionPlan.readyForExecutionGate === true,
        riskCount: executionPlan.riskCount ?? null,
        risks: normalizeRisks(executionPlan.risks),
        readiness: stableValue(asObject(executionPlan.readiness)),
        manifest: {
          approved: manifest.approved === true,
          approvedBy: manifest.approvedBy || null,
          rollbackStance: manifest.rollbackStance || null,
          supportStance: manifest.supportStance || null,
          entryCount: manifest.entryCount ?? null,
          entries: normalizeManifestEntries(manifest.entries),
        },
        sideEffects: stableValue(asObject(executionPlan.sideEffects)),
      },
    },
  };
}

function buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({ artifact = {} } = {}) {
  const projection = buildPolicyCompatibilityDeletionExecutionPlanArtifactProjection(artifact);
  const fingerprint = createHash('sha256')
    .update(stableStringify(projection))
    .digest('hex');

  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    fingerprint,
    provenance: {
      artifactVersion: projection.artifact.version,
      generatedAt: projection.artifact.generatedAt,
      statusId: projection.artifact.statusId,
      ready: projection.artifact.ready,
      manifestEntryCount: projection.artifact.executionPlan.manifest.entryCount,
      evidenceBundleGeneratedAt: projection.artifact.evidenceBundle.generatedAt,
    },
  };
}

function validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
  artifact = null,
  artifactFingerprint = null,
} = {}) {
  const issues = [];

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
        .MISSING_ARTIFACT,
      message: 'Execution-plan artifact fingerprint validation requires an artifact object.',
    });
  }

  if (
    !artifactFingerprint ||
    typeof artifactFingerprint !== 'object' ||
    Array.isArray(artifactFingerprint)
  ) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
        .MISSING_FINGERPRINT,
      message: 'Execution-plan artifact fingerprint validation requires a fingerprint artifact.',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issueCount: issues.length, issues };
  }

  const expected = buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({ artifact });
  const actualFingerprint = String(artifactFingerprint.fingerprint || '').trim().toLowerCase();

  if (
    artifactFingerprint.version !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_VERSION ||
    artifactFingerprint.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(actualFingerprint)
  ) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
        .MALFORMED_FINGERPRINT,
      message: 'Execution-plan artifact fingerprint must be a versioned SHA-256 hex digest.',
    });
  }

  if (actualFingerprint && actualFingerprint !== expected.fingerprint) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
        .FINGERPRINT_MISMATCH,
      message: 'Execution-plan artifact fingerprint must match the exact bounded artifact projection.',
    });
  }

  const provenance = asObject(artifactFingerprint.provenance);
  if (
    provenance.artifactVersion !== expected.provenance.artifactVersion ||
    provenance.generatedAt !== expected.provenance.generatedAt ||
    provenance.statusId !== expected.provenance.statusId ||
    provenance.ready !== expected.provenance.ready ||
    Number(provenance.manifestEntryCount) !== Number(expected.provenance.manifestEntryCount) ||
    provenance.evidenceBundleGeneratedAt !== expected.provenance.evidenceBundleGeneratedAt
  ) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
        .PROVENANCE_MISMATCH,
      message: 'Execution-plan artifact fingerprint provenance must match the bounded artifact projection.',
    });
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_VERSION,
  buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
  buildPolicyCompatibilityDeletionExecutionPlanArtifactProjection,
  validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
};
