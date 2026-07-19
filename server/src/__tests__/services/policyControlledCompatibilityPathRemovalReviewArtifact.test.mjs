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
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_VERSION,
  buildPolicyControlledCompatibilityPathRemovalReviewArtifact,
  validatePolicyControlledCompatibilityPathRemovalReviewArtifact,
} from '../../services/policyControlledCompatibilityPathRemovalReviewArtifact.mjs';

const FINGERPRINT = 'a'.repeat(64);

function removalReview(overrides = {}) {
  return {
    version: 'policy.controlled_compatibility_path_removal.v3',
    statusId: 'ready_for_removal_review',
    readyForRemovalReview: true,
    riskCount: 0,
    risks: [],
    executionContext: {
      executionPlanArtifact: {
        artifactFingerprint: { fingerprint: FINGERPRINT },
      },
      executionGate: {
        executionPlanArtifact: {
          artifactFingerprint: { fingerprint: FINGERPRINT },
        },
      },
    },
    removalBatch: {
      selectedCount: 1,
      requestedPathCount: 1,
      maxBatchSize: 1,
      removalReason: 'Remove the reviewed compatibility path after its replacement is verified.',
      reviewedBy: 'policy-maintainer',
      missingPaths: [],
      entries: [{
        categoryId: 'client_bridge_ui',
        actionId: 'delete_file',
        path: 'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
        deletionIntent: 'Remove bridge-only UI after native replacement.',
        replacementEvidence: { tests: ['PolicyBuilderLibraryContext.test.js'] },
      }],
    },
    executionPolicy: { requireGateArtifactCohesion: true },
    sideEffects: { filesDeleted: false },
    ...overrides,
  };
}

describe('policyControlledCompatibilityPathRemovalReviewArtifact', () => {
  test('binds the reviewed execution context and selected removal entry', () => {
    const review = removalReview();
    const artifact = buildPolicyControlledCompatibilityPathRemovalReviewArtifact({
      removalReview: review,
    });

    expect(artifact.version)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_VERSION);
    expect(artifact.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(validatePolicyControlledCompatibilityPathRemovalReviewArtifact({
      removalReview: review,
      reviewArtifact: artifact,
    })).toEqual(expect.objectContaining({ ok: true }));
  });

  test('rejects a review whose selected entry or gate context changes after review', () => {
    const review = removalReview();
    const artifact = buildPolicyControlledCompatibilityPathRemovalReviewArtifact({
      removalReview: review,
    });
    const changedReview = removalReview({
      executionContext: {
        ...review.executionContext,
        executionGate: {
          executionPlanArtifact: {
            artifactFingerprint: { fingerprint: 'b'.repeat(64) },
          },
        },
      },
      removalBatch: {
        ...review.removalBatch,
        entries: [{
          ...review.removalBatch.entries[0],
          path: 'server/src/services/policyIntentMapper.mjs',
        }],
      },
    });

    const validation = validatePolicyControlledCompatibilityPathRemovalReviewArtifact({
      removalReview: changedReview,
      reviewArtifact: artifact,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_MISMATCH,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_PROVENANCE_MISMATCH,
    ]));
  });
});
