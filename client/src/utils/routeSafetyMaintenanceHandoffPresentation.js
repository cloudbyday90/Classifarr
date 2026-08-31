/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const ROUTE_SAFETY_MAINTENANCE_HANDOFF_VERSION = 'classification.route_safety_maintenance_handoff.v1'

const SAFE_COUNT_PATTERN = /^\d+$/

const HANDOFF_DETAILS_BY_GATE_ID = Object.freeze({
  policy_confirmation_required: Object.freeze({
    heading: 'Repeated policy confirmations',
    message: 'The same policy-confirmation safeguard was the representative primary gate in two completed reporting windows. Review confirmation and automatic thresholds before changing any policy.',
  }),
  policy_destination_selection_required: Object.freeze({
    heading: 'Repeated destination selections',
    message: 'The same destination-selection safeguard was the representative primary gate in two completed reporting windows. Review destination rules and library ownership before changing any policy.',
  }),
  manual_policy_evidence_review_required: Object.freeze({
    heading: 'Repeated policy evidence reviews',
    message: 'The same evidence-review safeguard was the representative primary gate in two completed reporting windows. Review the evidence conditions before changing any policy.',
  }),
  policy_score_below_automatic_threshold: Object.freeze({
    heading: 'Repeated below-threshold decisions',
    message: 'The same below-threshold safeguard was the representative primary gate in two completed reporting windows. Review thresholds and policy evidence before changing any policy.',
  }),
  policy_threshold_unavailable: Object.freeze({
    heading: 'Policy threshold configuration needs review',
    message: 'The same missing-threshold safeguard was the representative primary gate in two completed reporting windows. Review confirmation and automatic thresholds before changing any policy.',
  }),
  policy_auto_provenance_required: Object.freeze({
    heading: 'Repeated policy route provenance reviews',
    message: 'The same route-provenance safeguard was the representative primary gate in two completed reporting windows. Review policy route requirements before changing any policy.',
  }),
  low_confidence_review_required: Object.freeze({
    heading: 'Repeated low-confidence reviews',
    message: 'The same low-confidence safeguard was the representative primary gate in two completed reporting windows. Review policy evidence and thresholds before changing any policy.',
  }),
})

function nonnegativeSafeCount(value) {
  const normalized = String(value ?? '').trim()
  if (!SAFE_COUNT_PATTERN.test(normalized)) return 0

  const numericValue = Number(normalized)
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0
}

function buildNotRecommendedPresentation() {
  return Object.freeze({
    statusId: 'not_recommended',
    isRecommended: false,
    heading: '',
    message: '',
    actionLabel: '',
  })
}

/**
 * Revalidates the aggregate-only handoff before rendering. The browser maps
 * only fixed gate identifiers to fixed copy and never trusts server text,
 * URLs, counts, policy identifiers, or any media-derived field.
 */
export function buildRouteSafetyMaintenanceHandoffPresentation(report = null) {
  if (report?.version !== ROUTE_SAFETY_MAINTENANCE_HANDOFF_VERSION ||
      report?.status?.id !== 'review_recommended') {
    return buildNotRecommendedPresentation()
  }

  const gateId = typeof report?.handoff?.gateId === 'string' ? report.handoff.gateId : ''
  const details = HANDOFF_DETAILS_BY_GATE_ID[gateId]
  const currentCount = nonnegativeSafeCount(report?.handoff?.currentCount)
  const previousCount = nonnegativeSafeCount(report?.handoff?.previousCount)

  if (!details || currentCount === 0 || previousCount === 0) {
    return buildNotRecommendedPresentation()
  }

  return Object.freeze({
    statusId: 'review_recommended',
    isRecommended: true,
    heading: details.heading,
    message: details.message,
    actionLabel: 'Review policy configuration',
  })
}
