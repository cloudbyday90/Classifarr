/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS = Object.freeze({
  NO_SPECIALIZED_PURPOSE: 'no_specialized_purpose',
  PROFILE_ONLY_SPECIALIZED_PURPOSE: 'profile_only_specialized_purpose',
  RETAINED_SPECIALIZED_PURPOSE_AVAILABLE: 'retained_specialized_purpose_available',
});

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

/**
 * Reduces source provenance for content-bearing purpose rules to fixed counts.
 * Callers supply aggregate values only; rule terms and profile evidence never
 * cross this contract boundary.
 */
export function buildPolicyPurposeCoverageProvenance(record = {}) {
  const specializedPurposeRuleCount = asNonNegativeInteger(record.specialized_purpose_rule_count);
  const inferredProfilePurposeRuleCount = Math.min(
    specializedPurposeRuleCount,
    asNonNegativeInteger(record.inferred_profile_purpose_rule_count),
  );
  const retainedPurposeRuleCount = specializedPurposeRuleCount - inferredProfilePurposeRuleCount;

  const statusId = specializedPurposeRuleCount === 0
    ? POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.NO_SPECIALIZED_PURPOSE
    : retainedPurposeRuleCount === 0
      ? POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.PROFILE_ONLY_SPECIALIZED_PURPOSE
      : POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.RETAINED_SPECIALIZED_PURPOSE_AVAILABLE;

  return {
    statusId,
    specializedPurposeRuleCount,
    inferredProfilePurposeRuleCount,
    retainedPurposeRuleCount,
  };
}
