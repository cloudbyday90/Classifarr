/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS = Object.freeze({
  NORMAL_LIFECYCLE_RECEIPT_REQUIRED: 'normal_lifecycle_receipt_required',
  COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED: 'complete_declared_purpose_evidence_required',
  ELIGIBILITY_AUDIT_AVAILABLE: 'eligibility_audit_available',
  UNAVAILABLE: 'held_out_semantic_study_readiness_unavailable',
})

export const HELD_OUT_SEMANTIC_STUDY_READINESS_VERSION =
  'policy.held_out_semantic_study_readiness.v2'

const VALID_STATUS_IDS = new Set(Object.values(HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS))
const VALID_FIELDS = new Set([
  'version',
  'statusId',
  'normalLifecycleReceiptCount',
  'completePolicyEvidenceCount',
  'reAuditPreconditionSatisfied',
  'rawConfigurationExposed',
  'libraryIdentityExposed',
  'mediaIdentityExposed',
  'semanticCohortReady',
  'independentLabelsAvailable',
  'semanticSelectionAffected',
  'routingAffected',
])

function nonNegativeCount(value) {
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 ? count : null
}

/**
 * Accepts only the closed aggregate readiness projection. The browser never
 * receives a library, policy, rule, receipt, configuration, or media identity.
 */
export function normalizeHeldOutSemanticStudyReadiness(value) {
  if (!value || typeof value !== 'object') return null
  if (value.version !== HELD_OUT_SEMANTIC_STUDY_READINESS_VERSION) return null
  if (Object.keys(value).some(key => !VALID_FIELDS.has(key))) return null
  if (
    value.rawConfigurationExposed !== false ||
    value.libraryIdentityExposed !== false ||
    value.mediaIdentityExposed !== false ||
    value.semanticCohortReady !== false ||
    value.independentLabelsAvailable !== false ||
    value.semanticSelectionAffected !== false ||
    value.routingAffected !== false
  ) return null

  const normalLifecycleReceiptCount = nonNegativeCount(value.normalLifecycleReceiptCount)
  const completePolicyEvidenceCount = nonNegativeCount(value.completePolicyEvidenceCount)
  if (normalLifecycleReceiptCount === null || completePolicyEvidenceCount === null) return null

  const expectedStatusId = normalLifecycleReceiptCount === 0
    ? HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.NORMAL_LIFECYCLE_RECEIPT_REQUIRED
    : completePolicyEvidenceCount === 0
      ? HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED
      : HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE
  const unavailable = value.statusId === HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.UNAVAILABLE
  const statusMatchesCounts = unavailable
    ? normalLifecycleReceiptCount === 0 && completePolicyEvidenceCount === 0
    : value.statusId === expectedStatusId
  const reAuditPreconditionSatisfied = value.statusId ===
    HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE

  if (
    !VALID_STATUS_IDS.has(value.statusId) ||
    !statusMatchesCounts ||
    value.reAuditPreconditionSatisfied !== reAuditPreconditionSatisfied
  ) return null

  return {
    version: HELD_OUT_SEMANTIC_STUDY_READINESS_VERSION,
    statusId: value.statusId,
    normalLifecycleReceiptCount,
    completePolicyEvidenceCount,
    reAuditPreconditionSatisfied,
    rawConfigurationExposed: false,
    libraryIdentityExposed: false,
    mediaIdentityExposed: false,
    semanticCohortReady: false,
    independentLabelsAvailable: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  }
}
