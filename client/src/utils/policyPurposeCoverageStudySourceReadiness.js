/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS = Object.freeze({
  NO_ACTIVE_VALIDATED_NATIVE_POLICY: 'no_active_validated_native_policy',
  NO_RETAINED_DECLARED_PURPOSE_SOURCE: 'no_retained_declared_purpose_source',
  NORMAL_LIFECYCLE_PROVENANCE_REQUIRED: 'normal_lifecycle_provenance_required',
  NORMAL_LIFECYCLE_PROVENANCE_REVIEW_REQUIRED:
    'normal_lifecycle_provenance_review_required',
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
  if (!value || typeof value !== 'object') {
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
  const lifecycleRetainedPurposePolicyCount = Math.min(
    retainedPurposePolicyCount,
    nonNegativeCount(value.lifecycleRetainedPurposePolicyCount),
  )
  const lifecycleReceiptReviewRequiredPolicyCount = Math.min(
    retainedPurposePolicyCount - lifecycleRetainedPurposePolicyCount,
    nonNegativeCount(value.lifecycleReceiptReviewRequiredPolicyCount),
  )
  const lifecycleReceiptRequiredPolicyCount = retainedPurposePolicyCount -
    lifecycleRetainedPurposePolicyCount - lifecycleReceiptReviewRequiredPolicyCount
  const heldOutAuditCandidateSourceAvailable = lifecycleRetainedPurposePolicyCount > 0
  const expectedStatusId = activePolicyCount === 0
    ? POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS.NO_ACTIVE_VALIDATED_NATIVE_POLICY
    : retainedPurposePolicyCount === 0
      ? POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS
        .NO_RETAINED_DECLARED_PURPOSE_SOURCE
      : heldOutAuditCandidateSourceAvailable
        ? POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS
          .RETAINED_DECLARED_PURPOSE_SOURCE_AVAILABLE
        : lifecycleReceiptReviewRequiredPolicyCount > 0
          ? POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS
            .NORMAL_LIFECYCLE_PROVENANCE_REVIEW_REQUIRED
          : POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS
            .NORMAL_LIFECYCLE_PROVENANCE_REQUIRED

  if (!VALID_STATUS_IDS.has(value.statusId) || value.statusId !== expectedStatusId) {
    return null
  }

  return {
    statusId: expectedStatusId,
    activePolicyCount,
    profileOnlyPurposePolicyCount,
    retainedPurposePolicyCount,
    lifecycleRetainedPurposePolicyCount,
    lifecycleReceiptRequiredPolicyCount,
    lifecycleReceiptReviewRequiredPolicyCount,
    heldOutAuditCandidateSourceAvailable,
    semanticCohortReady: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  }
}
