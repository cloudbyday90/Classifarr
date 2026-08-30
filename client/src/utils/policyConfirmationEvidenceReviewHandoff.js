/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CONFIRMATION_EVIDENCE_REVIEW_FOCUS = Object.freeze({
  PURPOSE_COVERAGE: 'purpose-coverage',
})

const DECLARED_SCOPE_REVIEW_HANDOFF = Object.freeze({
  label: 'Review existing policy purpose coverage',
  to: Object.freeze({
    name: 'PolicyNativeIntentReconciliation',
    query: Object.freeze({
      focus: POLICY_CONFIRMATION_EVIDENCE_REVIEW_FOCUS.PURPOSE_COVERAGE,
    }),
  }),
})

/**
 * Maps only the fixed aggregate readiness outcome to an existing,
 * administrator-gated maintenance view. The route never carries a policy,
 * library, item, provider, or telemetry identifier.
 */
export function getPolicyConfirmationEvidenceReviewHandoff(statusId) {
  return statusId === 'declared_scope_review_recommended'
    ? DECLARED_SCOPE_REVIEW_HANDOFF
    : null
}

export function isPolicyConfirmationEvidenceReviewFocus(value) {
  return value === POLICY_CONFIRMATION_EVIDENCE_REVIEW_FOCUS.PURPOSE_COVERAGE
}
