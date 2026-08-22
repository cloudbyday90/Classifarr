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

import {
  buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint,
} from './policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';
import { stableStringify } from './policyEvidenceFingerprint.mjs';

const POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_FINGERPRINT_VERSION =
  'policy.compatibility_deletion_release_review_artifact_fingerprint.v1';
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(asObject(value)).every(key => allowedKeys.includes(key));
}

function normalizeRiskIds(risks = []) {
  return asArray(risks)
    .map(risk => typeof risk?.riskId === 'string' ? risk.riskId : null)
    .filter(Boolean)
    .sort();
}

function buildEvidenceSummary(source = {}) {
  const value = asObject(source);

  return {
    generatedAt: value.generatedAt || null,
    statusId: value.statusId || null,
    validationOk: value.validationOk === true || value.validation?.ok === true,
    version: value.version || null,
    unconvertedPolicyCount:
      value.unconvertedPolicyCount ?? value.policyCounts?.unconvertedPolicyCount ?? null,
    requiresMaintenanceStateCount: value.requiresMaintenanceStateCount ?? null,
    backupRestoreVerified: value.backupRestoreVerified === true,
    latestVerifiedAt: value.latestVerifiedAt ?? value.verification?.latestVerifiedAt ?? null,
  };
}

function buildReleasePrerequisiteContextFromEvidenceBundle(evidenceBundle = {}) {
  const bundle = asObject(evidenceBundle);
  const evidence = asObject(bundle.evidence);
  const readiness = asObject(bundle.deletionReadiness);

  return {
    backupRestoreEvidence: evidence.backupRestoreEvidence,
    currentPolicyInventory: evidence.currentPolicyInventory,
    cutoverVerification: evidence.cutoverVerification,
    deletionGatePlan: evidence.deletionGatePlan,
    reconciliationStateInventory: evidence.reconciliationStateInventory,
    residualCompatibilityReferences: readiness.residualCompatibilityReferences,
  };
}

function buildReleasePrerequisiteContextFromSourceProjection(sourceProjection = {}) {
  const source = asObject(sourceProjection);

  return {
    backupRestoreEvidence: source.backupRestoreEvidence,
    currentPolicyInventory: source.currentPolicyInventory,
    cutoverVerification: source.cutoverVerification,
    deletionGatePlan: source.deletionGatePlan,
    reconciliationStateInventory: source.reconciliationStateInventory,
    residualCompatibilityReferences: source.residualCompatibilityReferences,
  };
}

function buildPolicyCompatibilityDeletionReleaseReviewSourceProjection({
  executionPlanEvidenceBundle = {},
} = {}) {
  const bundle = asObject(executionPlanEvidenceBundle);
  const evidence = asObject(bundle.evidence);

  return {
    generatedAt: bundle.generatedAt || null,
    readyForExecutionPlan: bundle.readyForExecutionPlan === true,
    riskIds: normalizeRiskIds(bundle.risks),
    riskCount: Number.isInteger(bundle.riskCount) ? bundle.riskCount : null,
    statusId: bundle.statusId || null,
    version: bundle.version || null,
    residualCompatibilityReferences: asArray(
      asObject(bundle.deletionReadiness).residualCompatibilityReferences
    ).map(reference => ({
      owner: reference?.owner || null,
      path: reference?.path || null,
      replacement: reference?.replacement || null,
    })),
    currentPolicyInventory: buildEvidenceSummary(evidence.currentPolicyInventory),
    reconciliationStateInventory: buildEvidenceSummary(evidence.reconciliationStateInventory),
    cutoverVerification: buildEvidenceSummary(evidence.cutoverVerification),
    deletionGatePlan: buildEvidenceSummary(evidence.deletionGatePlan),
    backupRestoreEvidence: buildEvidenceSummary(evidence.backupRestoreEvidence),
  };
}

function buildSourceBundleFingerprint(sourceProjection = {}) {
  return {
    algorithm: 'sha256',
    fingerprint: createHash('sha256')
      .update(stableStringify(sourceProjection), 'utf8')
      .digest('hex'),
    version: POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_FINGERPRINT_VERSION,
  };
}

function buildPolicyCompatibilityDeletionReleaseReviewArtifactProjection(artifact = {}) {
  const value = asObject(artifact);
  const sourceEvidence = asObject(value.sourceEvidence);

  return {
    version: value.version || null,
    generatedAt: value.generatedAt || null,
    statusId: value.statusId || null,
    reviewRequired: value.reviewRequired === true,
    reviewExpiresAt: value.reviewExpiresAt || null,
    sourceRiskCount: value.sourceRiskCount ?? null,
    sourceRisks: asArray(value.sourceRisks)
      .map(risk => ({ riskId: risk?.riskId || null }))
      .sort((left, right) => String(left.riskId).localeCompare(String(right.riskId))),
    sourceEvidence: {
      executionPlanEvidenceBundle: asObject(sourceEvidence.executionPlanEvidenceBundle),
      sourceBundleFingerprint: asObject(sourceEvidence.sourceBundleFingerprint),
      releasePrerequisiteContextFingerprint:
        asObject(sourceEvidence.releasePrerequisiteContextFingerprint),
    },
    reviewRequirements: asObject(value.reviewRequirements),
    sideEffects: asObject(value.sideEffects),
  };
}

function buildPolicyCompatibilityDeletionReleaseReviewArtifactFingerprint({ artifact = {} } = {}) {
  const projection = buildPolicyCompatibilityDeletionReleaseReviewArtifactProjection(artifact);

  return {
    algorithm: 'sha256',
    fingerprint: createHash('sha256')
      .update(stableStringify(projection), 'utf8')
      .digest('hex'),
    provenance: {
      artifactVersion: projection.version,
      generatedAt: projection.generatedAt,
      sourceEvidenceGeneratedAt: projection.sourceEvidence.executionPlanEvidenceBundle
        .generatedAt || null,
      sourceStatusId: projection.sourceEvidence.executionPlanEvidenceBundle.statusId || null,
    },
    version: POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_FINGERPRINT_VERSION,
  };
}

function isExpectedFingerprint(value, expected) {
  const fingerprint = asObject(value);

  return hasOnlyKeys(fingerprint, Object.keys(expected)) &&
    fingerprint.version === expected.version &&
    fingerprint.algorithm === expected.algorithm &&
    fingerprint.fingerprint === expected.fingerprint &&
    SHA256_FINGERPRINT_PATTERN.test(String(fingerprint.fingerprint || '')) &&
    stableStringify(fingerprint) === stableStringify(expected);
}

function buildSourceEvidence({ executionPlanEvidenceBundle = {} } = {}) {
  const sourceProjection =
    buildPolicyCompatibilityDeletionReleaseReviewSourceProjection({ executionPlanEvidenceBundle });
  const sourceContext =
    buildReleasePrerequisiteContextFromEvidenceBundle(executionPlanEvidenceBundle);

  return {
    executionPlanEvidenceBundle: sourceProjection,
    releasePrerequisiteContextFingerprint:
      buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint(sourceContext),
    sourceBundleFingerprint: buildSourceBundleFingerprint(sourceProjection),
  };
}

export {
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_FINGERPRINT_VERSION,
  SHA256_FINGERPRINT_PATTERN,
  buildPolicyCompatibilityDeletionReleaseReviewArtifactFingerprint,
  buildPolicyCompatibilityDeletionReleaseReviewArtifactProjection,
  buildPolicyCompatibilityDeletionReleaseReviewSourceProjection,
  buildReleasePrerequisiteContextFromEvidenceBundle,
  buildReleasePrerequisiteContextFromSourceProjection,
  buildSourceEvidence,
  buildSourceBundleFingerprint,
  isExpectedFingerprint,
};
