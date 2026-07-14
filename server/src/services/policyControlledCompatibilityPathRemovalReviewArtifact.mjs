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

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_VERSION =
  'policy.controlled_compatibility_path_removal_review_artifact.v1';

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS =
  Object.freeze({
    MISSING_REMOVAL_REVIEW: 'missing_removal_review',
    MISSING_REVIEW_ARTIFACT: 'missing_review_artifact',
    MALFORMED_REVIEW_ARTIFACT: 'malformed_review_artifact',
    REVIEW_ARTIFACT_MISMATCH: 'review_artifact_mismatch',
    REVIEW_ARTIFACT_PROVENANCE_MISMATCH: 'review_artifact_provenance_mismatch',
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

function normalizeEntries(entries = []) {
  return asArray(entries).map(entry => {
    const value = asObject(entry);

    return {
      actionId: value.actionId || null,
      categoryId: value.categoryId || null,
      deletionIntent: value.deletionIntent || null,
      path: value.path || null,
      replacementEvidence: stableValue(value.replacementEvidence ?? null),
    };
  });
}

function buildPolicyControlledCompatibilityPathRemovalReviewArtifactProjection(
  removalReview = {}
) {
  const review = asObject(removalReview);
  const executionContext = asObject(review.executionContext);
  const removalBatch = asObject(review.removalBatch);

  return {
    version: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_VERSION,
    removalReview: {
      version: review.version || null,
      statusId: review.statusId || null,
      readyForRemovalReview: review.readyForRemovalReview === true,
      riskCount: review.riskCount ?? null,
      risks: stableValue(asArray(review.risks)),
      executionContext: {
        executionPlanArtifact: stableValue(asObject(executionContext.executionPlanArtifact)),
        executionGate: stableValue(asObject(executionContext.executionGate)),
      },
      removalBatch: {
        selectedCount: removalBatch.selectedCount ?? null,
        requestedPathCount: removalBatch.requestedPathCount ?? null,
        maxBatchSize: removalBatch.maxBatchSize ?? null,
        removalReason: removalBatch.removalReason || null,
        reviewedBy: removalBatch.reviewedBy || null,
        missingPaths: asArray(removalBatch.missingPaths).map(path => String(path)),
        entries: normalizeEntries(removalBatch.entries),
      },
      executionPolicy: stableValue(asObject(review.executionPolicy)),
      sideEffects: stableValue(asObject(review.sideEffects)),
    },
  };
}

function buildPolicyControlledCompatibilityPathRemovalReviewArtifact({
  removalReview = {},
} = {}) {
  const projection = buildPolicyControlledCompatibilityPathRemovalReviewArtifactProjection(
    removalReview
  );
  const fingerprint = createHash('sha256')
    .update(stableStringify(projection))
    .digest('hex');
  const executionContext = asObject(asObject(removalReview).executionContext);

  return {
    version: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_VERSION,
    algorithm: 'sha256',
    fingerprint,
    provenance: {
      removalReviewVersion: projection.removalReview.version,
      statusId: projection.removalReview.statusId,
      readyForRemovalReview: projection.removalReview.readyForRemovalReview,
      selectedCount: projection.removalReview.removalBatch.selectedCount,
      executionPlanArtifactFingerprint:
        executionContext.executionPlanArtifact?.artifactFingerprint?.fingerprint || null,
      executionGateArtifactFingerprint:
        executionContext.executionGate?.executionPlanArtifact?.artifactFingerprint?.fingerprint ||
        null,
    },
  };
}

function validatePolicyControlledCompatibilityPathRemovalReviewArtifact({
  removalReview = null,
  reviewArtifact = null,
} = {}) {
  const issues = [];

  if (!removalReview || typeof removalReview !== 'object' || Array.isArray(removalReview)) {
    issues.push({
      riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .MISSING_REMOVAL_REVIEW,
      message: 'Removal review artifact validation requires a removal review object.',
    });
  }

  if (!reviewArtifact || typeof reviewArtifact !== 'object' || Array.isArray(reviewArtifact)) {
    issues.push({
      riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .MISSING_REVIEW_ARTIFACT,
      message: 'Removal review artifact validation requires a review artifact.',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issueCount: issues.length, issues };
  }

  const expected = buildPolicyControlledCompatibilityPathRemovalReviewArtifact({ removalReview });
  const actualFingerprint = String(reviewArtifact.fingerprint || '').trim().toLowerCase();

  if (
    reviewArtifact.version !== POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_VERSION ||
    reviewArtifact.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(actualFingerprint)
  ) {
    issues.push({
      riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .MALFORMED_REVIEW_ARTIFACT,
      message: 'Removal review artifact must be a versioned SHA-256 fingerprint.',
    });
  }

  if (actualFingerprint && actualFingerprint !== expected.fingerprint) {
    issues.push({
      riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_MISMATCH,
      message: 'Removal review artifact must match the exact reviewed execution context and batch.',
    });
  }

  const provenance = asObject(reviewArtifact.provenance);
  if (
    provenance.removalReviewVersion !== expected.provenance.removalReviewVersion ||
    provenance.statusId !== expected.provenance.statusId ||
    provenance.readyForRemovalReview !== expected.provenance.readyForRemovalReview ||
    Number(provenance.selectedCount) !== Number(expected.provenance.selectedCount) ||
    provenance.executionPlanArtifactFingerprint !==
      expected.provenance.executionPlanArtifactFingerprint ||
    provenance.executionGateArtifactFingerprint !==
      expected.provenance.executionGateArtifactFingerprint
  ) {
    issues.push({
      riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_PROVENANCE_MISMATCH,
      message: 'Removal review artifact provenance must match the reviewed execution context.',
    });
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_VERSION,
  buildPolicyControlledCompatibilityPathRemovalReviewArtifact,
  buildPolicyControlledCompatibilityPathRemovalReviewArtifactProjection,
  validatePolicyControlledCompatibilityPathRemovalReviewArtifact,
};
