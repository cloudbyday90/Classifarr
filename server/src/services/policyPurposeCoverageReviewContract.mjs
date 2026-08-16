/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_PURPOSE_COVERAGE_REVIEW_VERSION = 1;
export const DEFAULT_POLICY_PURPOSE_COVERAGE_REVIEW_ROWS = 50;
export const MAX_POLICY_PURPOSE_COVERAGE_REVIEW_ROWS = 100;

export const POLICY_PURPOSE_COVERAGE_STATUS_IDS = Object.freeze({
  DECLARED_SPECIALIZED_COVERAGE: 'declared_specialized_coverage',
  MISSING_SPECIALIZED_COVERAGE: 'missing_specialized_coverage',
  BROAD_OVERLAP_REVIEW_REQUIRED: 'broad_overlap_review_required',
});

export const POLICY_PURPOSE_COVERAGE_ACTION_IDS = Object.freeze({
  DECLARE_SPECIALIZED_PURPOSE: 'declare_specialized_purpose',
  REVIEW_BROAD_OVERLAP: 'review_broad_overlap',
  NO_ACTION_REQUIRED: 'no_action_required',
});

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function toIsoTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

export function normalizePolicyPurposeCoverageReviewLimit(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_POLICY_PURPOSE_COVERAGE_REVIEW_ROWS;
  }

  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 1) {
    return DEFAULT_POLICY_PURPOSE_COVERAGE_REVIEW_ROWS;
  }

  return Math.min(numericValue, MAX_POLICY_PURPOSE_COVERAGE_REVIEW_ROWS);
}

function buildCoverage(record = {}) {
  const requiredSignalTypeCount = asNonNegativeInteger(record.required_signal_type_count);
  const requiredTermCount = asNonNegativeInteger(record.required_term_count);
  const sharedRequiredTermCount = Math.min(
    requiredTermCount,
    asNonNegativeInteger(record.shared_required_term_count),
  );
  const uniqueRequiredTermCount = requiredTermCount - sharedRequiredTermCount;
  const overlappingDestinationCount = asNonNegativeInteger(record.overlapping_destination_count);

  const statusId = requiredTermCount === 0
    ? POLICY_PURPOSE_COVERAGE_STATUS_IDS.MISSING_SPECIALIZED_COVERAGE
    : uniqueRequiredTermCount === 0 && overlappingDestinationCount > 0
      ? POLICY_PURPOSE_COVERAGE_STATUS_IDS.BROAD_OVERLAP_REVIEW_REQUIRED
      : POLICY_PURPOSE_COVERAGE_STATUS_IDS.DECLARED_SPECIALIZED_COVERAGE;

  return {
    statusId,
    requiredSignalTypeCount,
    requiredTermCount,
    uniqueRequiredTermCount,
    sharedRequiredTermCount,
    overlappingDestinationCount,
  };
}

function buildAction(coverage = {}) {
  switch (coverage.statusId) {
    case POLICY_PURPOSE_COVERAGE_STATUS_IDS.MISSING_SPECIALIZED_COVERAGE:
      return {
        actionId: POLICY_PURPOSE_COVERAGE_ACTION_IDS.DECLARE_SPECIALIZED_PURPOSE,
        available: true,
        title: 'Declare specialized purpose coverage',
        description: 'This policy has no required genre, keyword, or studio signal that can express destination purpose. Add an explicit Belongs Here rule in the policy editor; library names, media type, history, profiles, RAG, and AI output do not substitute for declared purpose.',
        actionLabel: 'Review policy',
      };
    case POLICY_PURPOSE_COVERAGE_STATUS_IDS.BROAD_OVERLAP_REVIEW_REQUIRED:
      return {
        actionId: POLICY_PURPOSE_COVERAGE_ACTION_IDS.REVIEW_BROAD_OVERLAP,
        available: true,
        title: 'Review shared purpose coverage',
        description: 'Every current required content signal is also declared by another active destination of the same media type. Review the policy purpose for specificity in the existing editor; this report does not choose or alter a destination.',
        actionLabel: 'Review policy',
      };
    default:
      return {
        actionId: POLICY_PURPOSE_COVERAGE_ACTION_IDS.NO_ACTION_REQUIRED,
        available: false,
        title: 'Declared purpose coverage is distinct',
        description: 'At least one required content signal is not shared with another active destination of the same media type. This static review does not validate the semantic correctness of the policy or alter routing.',
        actionLabel: null,
      };
  }
}

export function buildPolicyPurposeCoverageReviewEntry(record = {}) {
  const policyId = asPositiveInteger(record.policy_id);
  const libraryId = asPositiveInteger(record.library_id);
  if (!policyId || !libraryId) return null;

  const coverage = buildCoverage(record);
  return {
    policy: {
      id: policyId,
      name: asNonEmptyString(record.policy_name) || 'Unnamed policy',
    },
    library: {
      id: libraryId,
      name: asNonEmptyString(record.library_name) || 'Unnamed library',
      mediaType: asNonEmptyString(record.library_media_type),
    },
    coverage,
    action: buildAction(coverage),
  };
}

export function buildPolicyPurposeCoverageReview({
  records = [],
  evaluatedAt = new Date(),
  limit = DEFAULT_POLICY_PURPOSE_COVERAGE_REVIEW_ROWS,
  truncated = false,
} = {}) {
  const entries = Array.isArray(records)
    ? records.map(buildPolicyPurposeCoverageReviewEntry).filter(Boolean)
    : [];

  const missingCoverageCount = entries.filter((entry) => (
    entry.coverage.statusId === POLICY_PURPOSE_COVERAGE_STATUS_IDS.MISSING_SPECIALIZED_COVERAGE
  )).length;
  const broadOverlapCount = entries.filter((entry) => (
    entry.coverage.statusId === POLICY_PURPOSE_COVERAGE_STATUS_IDS.BROAD_OVERLAP_REVIEW_REQUIRED
  )).length;

  return {
    version: `policy_purpose_coverage_review.v${POLICY_PURPOSE_COVERAGE_REVIEW_VERSION}`,
    evaluatedAt: toIsoTimestamp(evaluatedAt) || new Date().toISOString(),
    entries,
    summary: {
      reviewedPolicyCount: entries.length,
      declaredCoverageCount: entries.length - missingCoverageCount - broadOverlapCount,
      missingCoverageCount,
      broadOverlapCount,
      reportLimit: normalizePolicyPurposeCoverageReviewLimit(limit),
      truncated: truncated === true,
    },
    rawConfigurationExposed: false,
    routingAffected: false,
  };
}
