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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionActions.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
} from './policyCompatibilityDeletionExecutionGate.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS,
} from './policyCompatibilityDeletionPreApplyChangeDetector.mjs';
import {
  isPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
} from './policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_VERSION,
  validatePolicyControlledCompatibilityNamedScopeRemovalDryRun,
} from './policyControlledCompatibilityNamedScopeRemovalAdapter.mjs';
import {
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifactProjection,
} from './policyControlledCompatibilityNamedScopeRemovalReviewArtifactProjection.mjs';
import {
  DEFAULT_MAX_SCOPE_REMOVAL_DRY_RUN_AGE_MS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION,
  asArray,
  asObject,
  buildRisk,
  cleanString,
  hasExpectedReadOnlySideEffects,
  isSha256Fingerprint,
  normalizeEdit,
  normalizePreApplyVerification,
  normalizeReviewMetadata,
  normalizeTimestamp,
  uniqueStrings,
} from './policyControlledCompatibilityNamedScopeRemovalReviewArtifactShared.mjs';

function validateAcceptedScopeRemovalDryRun({
  maxDryRunAgeMs,
  now,
  scopeRemovalDryRun,
} = {}) {
  const issues = [];
  const dryRun = asObject(scopeRemovalDryRun);

  if (!scopeRemovalDryRun || typeof scopeRemovalDryRun !== 'object' ||
      Array.isArray(scopeRemovalDryRun)) {
    return [buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .MISSING_SCOPE_REMOVAL_DRY_RUN,
      'Scope-aware removal review artifact validation requires a dry-run object.'
    )];
  }

  const dryRunValidation = validatePolicyControlledCompatibilityNamedScopeRemovalDryRun(dryRun);
  if (dryRunValidation.ok !== true || dryRun.validation?.ok !== true) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .SCOPE_REMOVAL_DRY_RUN_INVALID,
      'Scope-aware removal review requires a dry run that remains internally valid.',
      { issueCount: dryRunValidation.issueCount }
    ));
  }

  if (dryRun.version !== POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_VERSION ||
      dryRun.statusId !== POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS
        .READY_FOR_SCOPE_REMOVAL_REVIEW ||
      dryRun.readyForScopeRemovalReview !== true ||
      dryRun.riskCount !== 0 ||
      asArray(dryRun.risks).length !== 0) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .SCOPE_REMOVAL_DRY_RUN_NOT_ACCEPTED,
      'Scope-aware removal review requires an accepted, risk-free dry run.'
    ));
  }

  const evaluationTime = normalizeTimestamp(dryRun.evaluationTime);
  const validationTime = normalizeTimestamp(now);
  const maximumAge = Number.isFinite(maxDryRunAgeMs) && maxDryRunAgeMs >= 0
    ? maxDryRunAgeMs
    : DEFAULT_MAX_SCOPE_REMOVAL_DRY_RUN_AGE_MS;

  if (!evaluationTime) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .INVALID_DRY_RUN_TIMESTAMP,
      'Scope-aware removal review requires a valid dry-run evaluation timestamp.'
    ));
  }
  if (!validationTime) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .INVALID_VALIDATION_TIMESTAMP,
      'Scope-aware removal review validation requires a valid current timestamp.'
    ));
  }
  if (evaluationTime && validationTime &&
      Date.parse(validationTime) - Date.parse(evaluationTime) > maximumAge) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .STALE_SCOPE_REMOVAL_DRY_RUN,
      'Scope-aware removal review requires a freshly re-read source snapshot.',
      { maxDryRunAgeMs: maximumAge }
    ));
  }

  const selectedScope = asObject(dryRun.selectedScope);
  const sourceDryRun = asObject(dryRun.dryRun);
  const source = asObject(dryRun.source);
  const executionGate = asObject(dryRun.executionGate);
  const preflight = asObject(dryRun.preflight);
  const scopeIdentity = cleanString(selectedScope.entryIdentity);
  const sourceFragments = asArray(selectedScope.sourceTextFragments).map(cleanString).filter(Boolean);
  const testNames = asArray(selectedScope.testNameFragments).map(cleanString).filter(Boolean);
  const edits = asArray(sourceDryRun.edits).map(normalizeEdit);

  if (!scopeIdentity || !scopeIdentity.startsWith('named_test_scope:') ||
      !isPolicyCompatibilityDeletionPreflightManifestObservationIdentity(scopeIdentity) ||
      cleanString(preflight.entryIdentity) !== scopeIdentity ||
      !cleanString(selectedScope.path) ||
      selectedScope.wholeFileDeletion !== false ||
      cleanString(selectedScope.actionId) !==
        POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .SCOPE_REMOVAL_DRY_RUN_INVALID,
      'Scope-aware removal review requires exactly one valid named-scope identity bound to preflight.'
    ));
  }
  if (new Set(testNames).size !== testNames.length) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .DUPLICATE_SCOPE_IDENTITY,
      'Scope-aware removal review rejects duplicate named-scope members.'
    ));
  }

  const expectedSourceFragments = uniqueStrings(sourceFragments);
  const sourceFragmentObservations = asArray(source.sourceFragmentObservations).map(observation => ({
    fragment: cleanString(observation?.fragment),
    occurrenceCount: observation?.occurrenceCount,
  }));
  const observedSourceFragments = sourceFragmentObservations.map(observation => observation.fragment)
    .filter(Boolean);
  if (sourceFragments.length === 0 || new Set(sourceFragments).size !== sourceFragments.length ||
      JSON.stringify(uniqueStrings(observedSourceFragments)) !==
        JSON.stringify(expectedSourceFragments) ||
      sourceFragmentObservations.some(observation => (
        !Number.isInteger(observation.occurrenceCount) || observation.occurrenceCount < 1
      ))) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .SCOPE_REMOVAL_DRY_RUN_INVALID,
      'Scope-aware removal review requires one or more currently observed source fragments.'
    ));
  }

  const expectedTestNames = uniqueStrings(testNames);
  const editTestNames = edits.map(edit => edit.testName).filter(Boolean);
  const validEdits = sourceDryRun.operationId ===
      POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE &&
    sourceDryRun.editCount === edits.length &&
    edits.length > 0 &&
    sourceDryRun.sourceFingerprint === source.fingerprint &&
    isSha256Fingerprint(source.fingerprint) &&
    isSha256Fingerprint(sourceDryRun.sourceFingerprint) &&
    isSha256Fingerprint(sourceDryRun.resultFingerprint) &&
    Number.isInteger(source.byteLength) && source.byteLength >= 0 &&
    JSON.stringify(uniqueStrings(editTestNames)) === JSON.stringify(expectedTestNames) &&
    new Set(editTestNames).size === editTestNames.length &&
    edits.every((edit, index) => (
      edit.testName &&
      isSha256Fingerprint(edit.expectedTextFingerprint) &&
      Number.isInteger(edit.startOffset) &&
      Number.isInteger(edit.endOffset) &&
      edit.startOffset >= 0 &&
      edit.endOffset > edit.startOffset &&
      (index === 0 || edits[index - 1].endOffset <= edit.startOffset)
    ));

  if (!validEdits) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .ALTERED_DRY_RUN_EDITS,
      'Scope-aware removal review requires contiguous, hash-backed edits for the exact selected scope.'
    ));
  }

  const verifiedPreflight = [preflight.beforeSourceRead, preflight.afterSourceRead]
    .map(normalizePreApplyVerification)
    .every(verification => (
      verification.statusId ===
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS.VERIFIED &&
      verification.verified === true &&
      verification.validationOk === true &&
      verification.riskIds.length === 0
    ));
  if (executionGate.originalValidationOk !== true ||
      executionGate.originalStatusId !==
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.READY_FOR_CONTROLLED_DELETION ||
      executionGate.revalidatedValidationOk !== true ||
      executionGate.revalidatedStatusId !==
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.READY_FOR_CONTROLLED_DELETION ||
      !isSha256Fingerprint(executionGate.executionPlanArtifactFingerprint) ||
      cleanString(preflight.observationStatusId) !== 'observed' ||
      !hasExpectedReadOnlySideEffects(dryRun.sideEffects) ||
      !verifiedPreflight) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .SCOPE_REMOVAL_DRY_RUN_INVALID,
      'Scope-aware removal review requires intact gate and two-pass preflight evidence.'
    ));
  }

  return issues;
}

function validateReviewMetadata({ review, scopeRemovalDryRun }) {
  const issues = [];
  const metadata = normalizeReviewMetadata(review);
  const evaluationTime = normalizeTimestamp(asObject(scopeRemovalDryRun).evaluationTime);

  if (!metadata.reviewedBy || !metadata.reviewReason) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .MISSING_REVIEWER_CONTEXT,
      'Scope-aware removal review requires a named reviewer and a non-empty review reason.'
    ));
  }
  if (!metadata.reviewedAt) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .INVALID_REVIEW_TIMESTAMP,
      'Scope-aware removal review requires a valid review timestamp.'
    ));
  }
  if (metadata.reviewedAt && evaluationTime &&
      Date.parse(metadata.reviewedAt) < Date.parse(evaluationTime)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_PRECEDES_DRY_RUN,
      'Scope-aware removal review cannot predate the source dry run it approves.'
    ));
  }

  return issues;
}

function validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
  maxDryRunAgeMs,
  now = new Date().toISOString(),
  review = null,
  reviewArtifact = null,
  scopeRemovalDryRun = null,
} = {}) {
  const issues = [
    ...validateAcceptedScopeRemovalDryRun({ maxDryRunAgeMs, now, scopeRemovalDryRun }),
    ...validateReviewMetadata({ review, scopeRemovalDryRun }),
  ];

  if (!reviewArtifact || typeof reviewArtifact !== 'object' || Array.isArray(reviewArtifact)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .MISSING_REVIEW_ARTIFACT,
      'Scope-aware removal review artifact validation requires a review artifact.'
    ));
    return { ok: false, issueCount: issues.length, issues };
  }

  const expected = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
    review,
    scopeRemovalDryRun,
  });
  const actualFingerprint = cleanString(reviewArtifact.fingerprint).toLowerCase();

  if (reviewArtifact.version !==
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION ||
      reviewArtifact.algorithm !== 'sha256' ||
      !isSha256Fingerprint(actualFingerprint)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .MALFORMED_REVIEW_ARTIFACT,
      'Scope-aware removal review artifact must be a versioned SHA-256 fingerprint.'
    ));
  }
  if (actualFingerprint && actualFingerprint !== expected.fingerprint) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_MISMATCH,
      'Scope-aware removal review artifact must match the exact source snapshot and bounded edits.'
    ));
  }

  const provenance = asObject(reviewArtifact.provenance);
  if (provenance.scopeRemovalDryRunVersion !== expected.provenance.scopeRemovalDryRunVersion ||
      provenance.scopeIdentity !== expected.provenance.scopeIdentity ||
      provenance.path !== expected.provenance.path ||
      provenance.executionPlanArtifactFingerprint !==
        expected.provenance.executionPlanArtifactFingerprint ||
      provenance.sourceFingerprint !== expected.provenance.sourceFingerprint ||
      provenance.resultFingerprint !== expected.provenance.resultFingerprint ||
      Number(provenance.editCount) !== Number(expected.provenance.editCount) ||
      provenance.reviewedBy !== expected.provenance.reviewedBy ||
      provenance.reviewedAt !== expected.provenance.reviewedAt) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_PROVENANCE_MISMATCH,
      'Scope-aware removal review artifact provenance must match its reviewed scope, gate, snapshot, and reviewer.'
    ));
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  DEFAULT_MAX_SCOPE_REMOVAL_DRY_RUN_AGE_MS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifactProjection,
  validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifact,
};
