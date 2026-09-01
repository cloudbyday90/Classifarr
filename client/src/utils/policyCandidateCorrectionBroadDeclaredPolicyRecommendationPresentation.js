/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const REVIEW_RECOMMENDED = 'review_recommended'
const COMPARABLE_COHORT = 'composition_comparable'

function reviewedPeriod(value) {
  const evidence = value?.contextualDeclaredPolicyEvidence
  const readiness = evidence?.calibrationReadiness
  if (readiness?.statusId !== REVIEW_RECOMMENDED ||
      !Number.isSafeInteger(evidence?.applicableDecisionCount) ||
      !Number.isSafeInteger(evidence?.changedSelectionOutcomeCount) ||
      evidence.applicableDecisionCount < 0 ||
      evidence.changedSelectionOutcomeCount < 0 ||
      evidence.changedSelectionOutcomeCount > evidence.applicableDecisionCount ||
      !Number.isFinite(evidence?.changedSelectionRatePercent) ||
      evidence.changedSelectionRatePercent < 0 || evidence.changedSelectionRatePercent > 100 ||
      typeof value?.window?.startDate !== 'string' || typeof value?.window?.endDate !== 'string') {
    return null
  }

  return Object.freeze({
    window: Object.freeze({
      startDate: value.window.startDate,
      endDate: value.window.endDate,
    }),
    applicableDecisionCount: evidence.applicableDecisionCount,
    changedSelectionOutcomeCount: evidence.changedSelectionOutcomeCount,
    changedSelectionRatePercent: evidence.changedSelectionRatePercent,
    changedSelectionConfidenceInterval: readiness.changedSelectionConfidenceInterval,
  })
}

/**
 * Converts only an already-normalized, aggregate-only long-horizon signal into
 * a human review recommendation. It cannot identify a policy, change a
 * threshold, invoke AI/RAG, or alter routing.
 */
export function getPolicyCandidateCorrectionBroadDeclaredPolicyRecommendation(longHorizonTrend) {
  if (longHorizonTrend?.cohortComposition?.statusId !== COMPARABLE_COHORT) return null

  const current = reviewedPeriod(longHorizonTrend.current)
  const previous = reviewedPeriod(longHorizonTrend.previous)
  if (!current || !previous) return null

  return Object.freeze({
    heading: 'Recommended next policy review',
    label: 'Review a policy that may be too broad',
    message: 'Across two comparable 28-day periods, operators chose a different destination often enough when the selected policy was a broad or general fit to warrant a scope review.',
    safeguard: 'This does not identify a policy, prove that policy caused any outcome, or change policy, AI, RAG, learning, or routing. Review representative decisions before editing a policy.',
    disclosureLabel: 'Why this recommendation is shown',
    current,
    previous,
  })
}
