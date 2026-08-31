/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const ROUTE_SAFETY_READINESS_VERSION = 'classification.route_safety_readiness.v1'

const MAX_PRIMARY_GATES = 3
const MAX_WINDOW_DAYS = 30
const SAFE_COUNT_PATTERN = /^\d+$/

const GATE_LABELS = Object.freeze({
  policy_confirmation_required: 'Policy confirmation',
  policy_destination_selection_required: 'Destination selection',
  manual_policy_evidence_review_required: 'Policy evidence review',
  policy_score_below_automatic_threshold: 'Below automatic threshold',
  policy_threshold_unavailable: 'Policy threshold unavailable',
  ai_advisory_cannot_route: 'AI advisory cannot route',
  provider_recovery_review_required: 'Provider recovery review',
  policy_auto_provenance_required: 'Policy route provenance review',
  administrative_confirmation_required: 'Administrative confirmation',
  fallback_result_review_required: 'Fallback result review',
  low_confidence_review_required: 'Low-confidence review',
  clarification_requested: 'Clarification requested',
})

const STATUS_DETAILS = Object.freeze({
  safeguards_observed: Object.freeze({
    label: 'Route safeguards observed',
    className: 'border-blue-800/70 bg-blue-950/10',
    badgeClassName: 'border-blue-700/70 bg-blue-950/30 text-blue-200',
    badgeLabel: 'Observing',
    message: 'Recent decisions were retained behind deterministic route safeguards. This is descriptive and does not change policy or routing.',
    guidance: Object.freeze([
      'Resolve a pending decision in Command Center before changing a policy.',
      'Review a policy only when its deterministic evidence repeatedly conflicts with operator decisions.',
    ]),
  }),
  no_recent_safeguard_decisions: Object.freeze({
    label: 'No recent safeguard decisions',
    className: 'border-gray-700 bg-gray-800/30',
    badgeClassName: 'border-gray-600 bg-gray-800 text-gray-200',
    badgeLabel: 'No recent data',
    message: 'No persisted route-safety decision was observed in the completed reporting window. This is not a policy-health or AI-readiness verdict.',
    guidance: Object.freeze([
      'Current classifications will still show their deterministic safeguard when one applies.',
    ]),
  }),
  unavailable: Object.freeze({
    label: 'Route-safety status unavailable',
    className: 'border-amber-800/70 bg-amber-950/10',
    badgeClassName: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
    badgeLabel: 'Unavailable',
    message: 'Classifarr could not read the aggregate route-safety status. Automatic routing and policy behavior are unchanged.',
    guidance: Object.freeze([
      'Refresh the saved readiness status or review the server logs if this persists.',
    ]),
  }),
})

function nonnegativeSafeCount(value) {
  const normalized = String(value ?? '').trim()
  if (!SAFE_COUNT_PATTERN.test(normalized)) return 0

  const numericValue = Number(normalized)
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0
}

function normalizeWindowDays(value) {
  const numericValue = Number(value)
  return Number.isSafeInteger(numericValue) && numericValue >= 1 && numericValue <= MAX_WINDOW_DAYS
    ? numericValue
    : 7
}

function normalizePrimaryGates(value) {
  const gatesById = new Map()

  for (const entry of Array.isArray(value) ? value : []) {
    const id = typeof entry?.id === 'string' ? entry.id : ''
    const label = GATE_LABELS[id]
    const count = nonnegativeSafeCount(entry?.count)
    if (!label || count === 0) continue

    gatesById.set(id, Math.min(Number.MAX_SAFE_INTEGER, (gatesById.get(id)?.count || 0) + count))
  }

  return [...gatesById.entries()]
    .map(([id, count]) => ({ id, label: GATE_LABELS[id], count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, MAX_PRIMARY_GATES)
}

/**
 * The server already returns a fixed aggregate, but this client boundary still
 * drops unexpected server strings before reactive UI or a live-region message
 * can render them.
 */
export function buildRouteSafetyReadinessPresentation(report = null) {
  if (report?.version !== ROUTE_SAFETY_READINESS_VERSION) {
    return Object.freeze({
      statusId: 'unavailable',
      ...STATUS_DETAILS.unavailable,
      windowDays: 7,
      observationCount: 0,
      primaryGates: Object.freeze([]),
    })
  }

  const observationCount = nonnegativeSafeCount(report?.observationCount)
  const statusId = observationCount > 0 && report?.status?.id === 'safeguards_observed'
    ? 'safeguards_observed'
    : (observationCount === 0 && report?.status?.id === 'no_recent_safeguard_decisions'
      ? 'no_recent_safeguard_decisions'
      : 'unavailable')

  return Object.freeze({
    statusId,
    ...STATUS_DETAILS[statusId],
    windowDays: normalizeWindowDays(report?.window?.days),
    observationCount,
    primaryGates: Object.freeze(normalizePrimaryGates(report?.primaryGates)),
  })
}
