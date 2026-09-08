/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS = Object.freeze({
  NO_ACTIVE_VALIDATED_NATIVE_POLICY: 'no_active_validated_native_policy',
  NO_RETAINED_DECLARED_PURPOSE_SOURCE: 'no_retained_declared_purpose_source',
  RETAINED_DECLARED_PURPOSE_SOURCE_AVAILABLE: 'retained_declared_purpose_source_available',
});

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

/**
 * Converts full-population policy-purpose provenance counts into a fixed,
 * advisory source-availability signal. A source is only an input to the
 * private eligibility audit; it never establishes a semantic cohort, label,
 * correctness claim, or routing authority.
 */
export function buildPolicyPurposeCoverageStudySourceReadiness(record = {}) {
  const activePolicyCount = asNonNegativeInteger(record.active_policy_count);
  const profileOnlyPurposePolicyCount = Math.min(
    activePolicyCount,
    asNonNegativeInteger(record.profile_only_purpose_policy_count),
  );
  const retainedPurposePolicyCount = Math.min(
    activePolicyCount - profileOnlyPurposePolicyCount,
    asNonNegativeInteger(record.retained_purpose_policy_count),
  );
  const heldOutAuditCandidateSourceAvailable = retainedPurposePolicyCount > 0;

  const statusId = activePolicyCount === 0
    ? POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS.NO_ACTIVE_VALIDATED_NATIVE_POLICY
    : heldOutAuditCandidateSourceAvailable
      ? POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS
        .RETAINED_DECLARED_PURPOSE_SOURCE_AVAILABLE
      : POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS
        .NO_RETAINED_DECLARED_PURPOSE_SOURCE;

  return {
    statusId,
    activePolicyCount,
    profileOnlyPurposePolicyCount,
    retainedPurposePolicyCount,
    heldOutAuditCandidateSourceAvailable,
    semanticCohortReady: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  };
}
