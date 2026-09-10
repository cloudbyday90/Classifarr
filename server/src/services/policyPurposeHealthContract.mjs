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

export const POLICY_PURPOSE_HEALTH_VERSION = 1;
export const POLICY_PURPOSE_HEALTH_STATUS_IDS = Object.freeze({
  READY: 'ready',
  ATTENTION_REQUIRED: 'attention_required',
  REVIEW_WINDOW_TRUNCATED: 'review_window_truncated',
  NO_ACTIVE_VALIDATED_NATIVE_POLICY: 'no_active_validated_native_policy',
});

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function recordLibraryId(record) {
  return asPositiveInteger(record?.library_id);
}

function countLibraries(records, predicate) {
  const libraryIds = new Set();
  for (const record of records) {
    const libraryId = recordLibraryId(record);
    if (libraryId && predicate(record)) libraryIds.add(libraryId);
  }
  return libraryIds.size;
}

function attentionLibraryCount(records) {
  return countLibraries(records, (record) => {
    const coverage = buildPolicyPurposeCoverage(record);
    const provenance = buildPolicyPurposeCoverageProvenance(record);
    return coverage.statusId !== POLICY_PURPOSE_COVERAGE_STATUS_IDS.DECLARED_SPECIALIZED_COVERAGE ||
      provenance.statusId !== POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.DECLARED_SPECIALIZED_PURPOSE_AVAILABLE;
  });
}

/**
 * Reduces bounded server-side purpose records to a Command Center health
 * snapshot. It deliberately returns aggregate counts only: no library,
 * policy, rule, profile, media, AI, RAG, or outcome data crosses this boundary.
 */
export function buildPolicyPurposeHealthSummary({
  records = [],
  truncated = false,
} = {}) {
  const validRecords = Array.isArray(records)
    ? records.filter((record) => recordLibraryId(record))
    : [];
  const reviewedLibraryCount = new Set(validRecords.map(recordLibraryId)).size;
  const reviewWindowTruncated = truncated === true;
  const declaredPurposeLibraryCount = countLibraries(validRecords, (record) => (
    buildPolicyPurposeCoverageProvenance(record).statusId ===
      POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.DECLARED_SPECIALIZED_PURPOSE_AVAILABLE
  ));
  const missingPurposeLibraryCount = countLibraries(validRecords, (record) => (
    buildPolicyPurposeCoverage(record).statusId ===
      POLICY_PURPOSE_COVERAGE_STATUS_IDS.MISSING_SPECIALIZED_COVERAGE
  ));
  const competingDestinationLibraryCount = countLibraries(validRecords, (record) => (
    buildPolicyPurposeCoverage(record).statusId ===
      POLICY_PURPOSE_COVERAGE_STATUS_IDS.BROAD_OVERLAP_REVIEW_REQUIRED
  ));
  const profileDerivedPurposeLibraryCount = countLibraries(validRecords, (record) => (
    buildPolicyPurposeCoverageProvenance(record).statusId ===
      POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.PROFILE_ONLY_SPECIALIZED_PURPOSE
  ));
  const unverifiedPurposeLibraryCount = countLibraries(validRecords, (record) => (
    buildPolicyPurposeCoverageProvenance(record).statusId ===
      POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.UNVERIFIED_PURPOSE_SOURCE
  ));
  const needsAttentionLibraryCount = attentionLibraryCount(validRecords);

  const statusId = reviewedLibraryCount === 0
    ? POLICY_PURPOSE_HEALTH_STATUS_IDS.NO_ACTIVE_VALIDATED_NATIVE_POLICY
    : reviewWindowTruncated
      ? POLICY_PURPOSE_HEALTH_STATUS_IDS.REVIEW_WINDOW_TRUNCATED
      : needsAttentionLibraryCount > 0
        ? POLICY_PURPOSE_HEALTH_STATUS_IDS.ATTENTION_REQUIRED
        : POLICY_PURPOSE_HEALTH_STATUS_IDS.READY;

  return {
    version: `policy_purpose_health.v${POLICY_PURPOSE_HEALTH_VERSION}`,
    statusId,
    summary: {
      reviewedLibraryCount,
      declaredPurposeLibraryCount,
      missingPurposeLibraryCount,
      competingDestinationLibraryCount,
      profileDerivedPurposeLibraryCount,
      unverifiedPurposeLibraryCount,
      needsAttentionLibraryCount,
      reviewWindowTruncated,
    },
    rawPurposeRulesExposed: false,
    libraryIdentityExposed: false,
    policyIdentityExposed: false,
    observedOutcomeDataExposed: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  };
}
