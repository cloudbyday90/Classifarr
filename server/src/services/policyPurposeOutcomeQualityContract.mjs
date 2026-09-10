/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyPurposeCoverage,
  POLICY_PURPOSE_COVERAGE_STATUS_IDS,
} from './policyPurposeCoverageReviewContract.mjs';
import {
  buildPolicyPurposeCoverageProvenance,
  POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS,
} from './policyPurposeCoverageProvenance.mjs';

export const POLICY_PURPOSE_OUTCOME_QUALITY_VERSION = 1;
export const POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS = Object.freeze({
  CORROBORATED: 'corroborated',
  REVIEW_REQUIRED: 'review_required',
  AWAITING_CONFIRMED_OUTCOMES: 'awaiting_confirmed_outcomes',
  NO_DECLARED_DISTINCT_PURPOSE: 'no_declared_distinct_purpose',
  REVIEW_WINDOW_TRUNCATED: 'review_window_truncated',
  READ_UNAVAILABLE: 'read_unavailable',
});

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function getLibraryId(record) {
  return asPositiveInteger(record?.library_id);
}

function hasDeclaredDistinctPurpose(record) {
  const coverage = buildPolicyPurposeCoverage(record);
  const provenance = buildPolicyPurposeCoverageProvenance(record);
  return coverage.statusId === POLICY_PURPOSE_COVERAGE_STATUS_IDS.DECLARED_SPECIALIZED_COVERAGE &&
    provenance.statusId ===
      POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.DECLARED_SPECIALIZED_PURPOSE_AVAILABLE;
}

function getEligibleLibraryIds(records) {
  const eligibilityByLibrary = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const libraryId = getLibraryId(record);
    if (!libraryId) continue;

    const existing = eligibilityByLibrary.get(libraryId) || {
      hasDeclaredDistinctPurpose: false,
      hasStructuralAttention: false,
    };
    if (hasDeclaredDistinctPurpose(record)) {
      existing.hasDeclaredDistinctPurpose = true;
    } else {
      existing.hasStructuralAttention = true;
    }
    eligibilityByLibrary.set(libraryId, existing);
  }
  return new Set(
    [...eligibilityByLibrary.entries()]
      .filter(([, eligibility]) => (
        eligibility.hasDeclaredDistinctPurpose && !eligibility.hasStructuralAttention
      ))
      .map(([libraryId]) => libraryId),
  );
}

function buildOutcomeRecordsByLibrary(records) {
  const recordsByLibrary = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const libraryId = getLibraryId(record);
    if (!libraryId || recordsByLibrary.has(libraryId)) continue;

    const confirmedOutcomeTermCount = asNonNegativeInteger(record.confirmed_outcome_term_count);
    const alignedOutcomeTermCount = Math.min(
      confirmedOutcomeTermCount,
      asNonNegativeInteger(record.declared_purpose_aligned_outcome_term_count),
    );
    recordsByLibrary.set(libraryId, {
      confirmedOutcomeTermCount,
      alignedOutcomeTermCount,
    });
  }
  return recordsByLibrary;
}

/**
 * Produces a provenance-bound, aggregate quality signal. A missing overlap is
 * a review priority, not proof that a destination or any individual outcome is
 * wrong. This output carries counts only and cannot create policy authority.
 */
export function buildPolicyPurposeOutcomeQualitySummary({
  records = [],
  outcomeRecords = [],
  readAvailable = true,
  truncated = false,
} = {}) {
  const reviewedLibraryIds = new Set(
    (Array.isArray(records) ? records : []).map(getLibraryId).filter(Boolean),
  );
  const eligibleLibraryIds = getEligibleLibraryIds(records);
  const reviewedLibraryCount = reviewedLibraryIds.size;
  const eligibleDeclaredPurposeLibraryCount = eligibleLibraryIds.size;
  const reviewWindowTruncated = truncated === true;
  const outcomeRecordsByLibrary = buildOutcomeRecordsByLibrary(outcomeRecords);
  let confirmedOutcomeLibraryCount = 0;
  let outcomeCorroboratedLibraryCount = 0;
  let outcomeReviewRequiredLibraryCount = 0;

  for (const libraryId of eligibleLibraryIds) {
    const outcomeRecord = outcomeRecordsByLibrary.get(libraryId);
    if (!outcomeRecord || outcomeRecord.confirmedOutcomeTermCount === 0) continue;

    confirmedOutcomeLibraryCount += 1;
    if (outcomeRecord.alignedOutcomeTermCount > 0) {
      outcomeCorroboratedLibraryCount += 1;
    } else {
      outcomeReviewRequiredLibraryCount += 1;
    }
  }

  const awaitingConfirmedOutcomeLibraryCount = Math.max(
    0,
    eligibleDeclaredPurposeLibraryCount - confirmedOutcomeLibraryCount,
  );
  const statusId = readAvailable !== true
    ? POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS.READ_UNAVAILABLE
    : reviewWindowTruncated
      ? POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS.REVIEW_WINDOW_TRUNCATED
      : eligibleDeclaredPurposeLibraryCount === 0
        ? POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS.NO_DECLARED_DISTINCT_PURPOSE
        : outcomeReviewRequiredLibraryCount > 0
          ? POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS.REVIEW_REQUIRED
          : confirmedOutcomeLibraryCount === 0
            ? POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS.AWAITING_CONFIRMED_OUTCOMES
            : POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS.CORROBORATED;

  return {
    version: `policy_purpose_outcome_quality.v${POLICY_PURPOSE_OUTCOME_QUALITY_VERSION}`,
    statusId,
    summary: {
      reviewedLibraryCount,
      eligibleDeclaredPurposeLibraryCount,
      confirmedOutcomeLibraryCount,
      outcomeCorroboratedLibraryCount,
      outcomeReviewRequiredLibraryCount,
      awaitingConfirmedOutcomeLibraryCount,
      reviewWindowTruncated,
    },
    confirmedOperatorOutcomeEvidenceOnly: true,
    stableClassificationAnchorRequired: true,
    rawOutcomeEvidenceExposed: false,
    libraryIdentityExposed: false,
    policyIdentityExposed: false,
    semanticSelectionAffected: false,
    policyChanged: false,
    aiRagTuningAffected: false,
    routingAffected: false,
    learningAffected: false,
  };
}
