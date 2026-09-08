/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS = Object.freeze({
  NO_ACTIVE_VALIDATED_NATIVE_POLICY: 'no_active_validated_native_policy',
  NO_RETAINED_DECLARED_PURPOSE_SOURCE: 'no_retained_declared_purpose_source',
  RETAINED_DECLARED_PURPOSE_SOURCE_AVAILABLE: 'retained_declared_purpose_source_available',
})

const VALID_STATUS_IDS = new Set(Object.values(
  POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS,
))

function nonNegativeCount(value) {
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 ? count : 0
}

export function normalizePolicyPurposeCoverageStudySourceReadiness(value) {
  if (!value || typeof value !== 'object' || !VALID_STATUS_IDS.has(value.statusId)) {
    return null
  }

  const activePolicyCount = nonNegativeCount(value.activePolicyCount)
  const profileOnlyPurposePolicyCount = Math.min(
    activePolicyCount,
    nonNegativeCount(value.profileOnlyPurposePolicyCount),
  )
  const retainedPurposePolicyCount = Math.min(
    activePolicyCount - profileOnlyPurposePolicyCount,
    nonNegativeCount(value.retainedPurposePolicyCount),
  )

  return {
    statusId: value.statusId,
    activePolicyCount,
    profileOnlyPurposePolicyCount,
    retainedPurposePolicyCount,
    heldOutAuditCandidateSourceAvailable:
      value.heldOutAuditCandidateSourceAvailable === true && retainedPurposePolicyCount > 0,
    semanticCohortReady: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  }
}
