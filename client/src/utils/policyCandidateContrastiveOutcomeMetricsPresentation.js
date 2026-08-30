/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const METRICS_VERSION = 'policy.candidate_contrastive_outcome_metrics.v1'

const STATUS_PRESENTATIONS = Object.freeze({
  leading_identity_match: Object.freeze({ label: 'Leader only' }),
  alternative_identity_match: Object.freeze({ label: 'Alternative only' }),
  shared_identity_match: Object.freeze({ label: 'Shared candidates' }),
  no_candidate_identity_match: Object.freeze({ label: 'No candidate match' }),
  identity_unverified: Object.freeze({ label: 'Identity unavailable' }),
  retrieval_unavailable: Object.freeze({ label: 'Inventory unavailable' }),
})

function nonnegativeCount(value) {
  const numericValue = Number(value)
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0
}

function ratePercent(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100
    ? Math.round(numericValue * 10) / 10
    : 0
}

function dateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function normalizeBucket(value) {
  const statusId = typeof value?.statusId === 'string' ? value.statusId : null
  const presentation = STATUS_PRESENTATIONS[statusId]
  if (!presentation) return null

  const observationCount = nonnegativeCount(value?.observationCount)
  const resolvedOutcomeCount = Math.min(observationCount, nonnegativeCount(value?.resolvedOutcomeCount))
  const attributedOutcomeCount = Math.min(resolvedOutcomeCount, nonnegativeCount(value?.attributedOutcomeCount))
  const confirmedCandidateOutcomeCount = Math.min(
    attributedOutcomeCount,
    nonnegativeCount(value?.confirmedCandidateOutcomeCount),
  )
  const changedToCandidateOutcomeCount = Math.min(
    attributedOutcomeCount - confirmedCandidateOutcomeCount,
    nonnegativeCount(value?.changedToCandidateOutcomeCount),
  )
  const changedOutsideCandidateOutcomeCount = Math.min(
    attributedOutcomeCount - confirmedCandidateOutcomeCount - changedToCandidateOutcomeCount,
    nonnegativeCount(value?.changedOutsideCandidateOutcomeCount),
  )
  const routedNotApplicableOutcomeCount = Math.min(
    attributedOutcomeCount - confirmedCandidateOutcomeCount - changedToCandidateOutcomeCount -
      changedOutsideCandidateOutcomeCount,
    nonnegativeCount(value?.routedNotApplicableOutcomeCount),
  )
  const applicableDecisionCount =
    confirmedCandidateOutcomeCount + changedToCandidateOutcomeCount + changedOutsideCandidateOutcomeCount

  return Object.freeze({
    statusId,
    label: presentation.label,
    observationCount,
    resolvedOutcomeCount,
    attributedOutcomeCount,
    confirmedCandidateOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidateOutcomeCount,
    routedNotApplicableOutcomeCount,
    unattributedResolvedOutcomeCount: Math.max(0, resolvedOutcomeCount - attributedOutcomeCount),
    applicableDecisionCount,
    changedSelectionRatePercent: ratePercent(value?.changedSelectionRatePercent),
    outsideCandidateRatePercent: ratePercent(value?.outsideCandidateRatePercent),
  })
}

/**
 * Accepts only the versioned, fixed aggregate report. The presentation never
 * accepts server-supplied labels, messages, identities, or metric dimensions.
 */
export function normalizePolicyCandidateContrastiveOutcomeMetricsReport(value) {
  if (value?.version !== METRICS_VERSION) return null

  const seenStatusIds = new Set()
  const buckets = (Array.isArray(value?.buckets) ? value.buckets : [])
    .map(normalizeBucket)
    .filter((bucket) => {
      if (!bucket || seenStatusIds.has(bucket.statusId)) return false
      seenStatusIds.add(bucket.statusId)
      return true
    })

  const observationCount = buckets.reduce((total, bucket) => total + bucket.observationCount, 0)
  const attributedOutcomeCount = buckets.reduce((total, bucket) => total + bucket.attributedOutcomeCount, 0)
  const applicableDecisionCount = buckets.reduce((total, bucket) => total + bucket.applicableDecisionCount, 0)
  const changedSelectionOutcomeCount = buckets.reduce((total, bucket) => (
    total + bucket.changedToCandidateOutcomeCount + bucket.changedOutsideCandidateOutcomeCount
  ), 0)

  return Object.freeze({
    version: METRICS_VERSION,
    window: Object.freeze({
      days: nonnegativeCount(value?.window?.days),
      startDate: dateOnly(value?.window?.startDate),
      endDate: dateOnly(value?.window?.endDate),
    }),
    buckets: Object.freeze(buckets),
    summary: Object.freeze({
      observationCount,
      attributedOutcomeCount,
      applicableDecisionCount,
      changedSelectionOutcomeCount,
      changedSelectionRatePercent: applicableDecisionCount
        ? Math.round((changedSelectionOutcomeCount / applicableDecisionCount) * 1000) / 10
        : 0,
    }),
    readiness: observationCount > 0
      ? Object.freeze({
        statusId: 'observing',
        label: 'Contrastive outcome observations are available',
        message: 'These aggregate associations describe prior advisory checks and later operator actions. They do not establish correctness or change policy, AI, or routing.',
      })
      : Object.freeze({
        statusId: 'insufficient_data',
        label: 'Contrastive outcome monitoring needs observations',
        message: 'No contrastive inventory observations have been recorded in this completed UTC-day window yet.',
      }),
  })
}
