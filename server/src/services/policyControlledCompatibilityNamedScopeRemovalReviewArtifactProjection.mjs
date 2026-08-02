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
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION,
  asArray,
  asObject,
  cleanString,
  normalizeEdit,
  normalizePreApplyVerification,
  normalizeReviewMetadata,
  normalizeTimestamp,
  stableStringify,
  stableValue,
  uniqueStrings,
} from './policyControlledCompatibilityNamedScopeRemovalReviewArtifactShared.mjs';

function buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifactProjection({
  review = {},
  scopeRemovalDryRun = {},
} = {}) {
  const dryRun = asObject(scopeRemovalDryRun);
  const selectedScope = asObject(dryRun.selectedScope);
  const executionGate = asObject(dryRun.executionGate);
  const preflight = asObject(dryRun.preflight);
  const source = asObject(dryRun.source);
  const sourceDryRun = asObject(dryRun.dryRun);

  return {
    version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION,
    review: normalizeReviewMetadata(review),
    scopeRemovalDryRun: {
      evaluationTime: normalizeTimestamp(dryRun.evaluationTime),
      executionGate: {
        executionPlanArtifactFingerprint:
          cleanString(executionGate.executionPlanArtifactFingerprint).toLowerCase() || null,
        originalStatusId: cleanString(executionGate.originalStatusId) || null,
        originalValidationOk: executionGate.originalValidationOk === true,
        revalidatedStatusId: cleanString(executionGate.revalidatedStatusId) || null,
        revalidatedValidationOk: executionGate.revalidatedValidationOk === true,
      },
      executionPolicy: stableValue(asObject(dryRun.executionPolicy)),
      preflight: {
        afterSourceRead: normalizePreApplyVerification(preflight.afterSourceRead),
        beforeSourceRead: normalizePreApplyVerification(preflight.beforeSourceRead),
        entryIdentity: cleanString(preflight.entryIdentity) || null,
        observationStatusId: cleanString(preflight.observationStatusId) || null,
      },
      readyForScopeRemovalReview: dryRun.readyForScopeRemovalReview === true,
      selectedScope: {
        actionId: cleanString(selectedScope.actionId) || null,
        entryIdentity: cleanString(selectedScope.entryIdentity) || null,
        path: cleanString(selectedScope.path) || null,
        sourceTextFragments: uniqueStrings(selectedScope.sourceTextFragments),
        testNameFragments: uniqueStrings(selectedScope.testNameFragments),
        wholeFileDeletion: selectedScope.wholeFileDeletion === false ? false : null,
      },
      source: {
        byteLength: Number.isInteger(source.byteLength) ? source.byteLength : null,
        fingerprint: cleanString(source.fingerprint).toLowerCase() || null,
        sourceFragmentObservations: asArray(source.sourceFragmentObservations)
          .map(observation => ({
            fragment: cleanString(observation?.fragment) || null,
            occurrenceCount: Number.isInteger(observation?.occurrenceCount)
              ? observation.occurrenceCount
              : null,
          }))
          .sort((left, right) => String(left.fragment).localeCompare(String(right.fragment))),
      },
      sourceEdit: {
        editCount: Number.isInteger(sourceDryRun.editCount) ? sourceDryRun.editCount : null,
        edits: asArray(sourceDryRun.edits).map(normalizeEdit),
        operationId: cleanString(sourceDryRun.operationId) || null,
        resultFingerprint: cleanString(sourceDryRun.resultFingerprint).toLowerCase() || null,
        sourceFingerprint: cleanString(sourceDryRun.sourceFingerprint).toLowerCase() || null,
      },
      sideEffects: stableValue(asObject(dryRun.sideEffects)),
      statusId: cleanString(dryRun.statusId) || null,
      version: cleanString(dryRun.version) || null,
    },
  };
}

function buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
  review = {},
  scopeRemovalDryRun = {},
} = {}) {
  const projection = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifactProjection({
    review,
    scopeRemovalDryRun,
  });
  const scopeDryRun = projection.scopeRemovalDryRun;

  return {
    version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION,
    algorithm: 'sha256',
    fingerprint: createHash('sha256')
      .update(stableStringify(projection))
      .digest('hex'),
    provenance: {
      editCount: scopeDryRun.sourceEdit.editCount,
      executionPlanArtifactFingerprint:
        scopeDryRun.executionGate.executionPlanArtifactFingerprint,
      path: scopeDryRun.selectedScope.path,
      resultFingerprint: scopeDryRun.sourceEdit.resultFingerprint,
      reviewedAt: projection.review.reviewedAt,
      reviewedBy: projection.review.reviewedBy,
      reviewMetadataFingerprint:
        buildPolicyControlledCompatibilityNamedScopeRemovalReviewMetadataFingerprint({ review }),
      scopeIdentity: scopeDryRun.selectedScope.entryIdentity,
      scopeRemovalDryRunVersion: scopeDryRun.version,
      scopeSnapshotFingerprint:
        buildPolicyControlledCompatibilityNamedScopeRemovalReviewScopeSnapshotFingerprint({
          scopeRemovalDryRun,
        }),
      sourceFingerprint: scopeDryRun.source.fingerprint,
    },
  };
}

function buildPolicyControlledCompatibilityNamedScopeRemovalReviewScopeSnapshotProjection({
  scopeRemovalDryRun = {},
} = {}) {
  const projection = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifactProjection({
    scopeRemovalDryRun,
  });
  const { evaluationTime: _evaluationTime, ...scopeSnapshot } = projection.scopeRemovalDryRun;

  return {
    version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION,
    scopeRemovalDryRun: scopeSnapshot,
  };
}

function buildPolicyControlledCompatibilityNamedScopeRemovalReviewScopeSnapshotFingerprint({
  scopeRemovalDryRun = {},
} = {}) {
  return createHash('sha256')
    .update(stableStringify(
      buildPolicyControlledCompatibilityNamedScopeRemovalReviewScopeSnapshotProjection({
        scopeRemovalDryRun,
      })
    ))
    .digest('hex');
}

function buildPolicyControlledCompatibilityNamedScopeRemovalReviewMetadataFingerprint({
  review = {},
} = {}) {
  return createHash('sha256')
    .update(stableStringify({
      version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION,
      review: normalizeReviewMetadata(review),
    }))
    .digest('hex');
}

export {
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifactProjection,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewMetadataFingerprint,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewScopeSnapshotFingerprint,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewScopeSnapshotProjection,
};
