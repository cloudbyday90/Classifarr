/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const STATUS_IDS = Object.freeze({
  COLLECTING: 'collecting',
  INSUFFICIENT_ACTIVITY: 'insufficient_activity',
  CONSISTENT: 'consistent',
  SHIFTED: 'shifted',
})

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

/** Drops unknown fields and never admits an authority-bearing consistency state. */
export function normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryConsistency(value) {
  const source = asPlainObject(value)
  if (!source || !Object.values(STATUS_IDS).includes(source.statusId) ||
      typeof source.comparisonAvailable !== 'boolean' || source.automaticPolicyChange !== false ||
      source.automaticAiRagTuning !== false || source.routingChanged !== false) return null

  const comparisonAvailable = source.statusId === STATUS_IDS.CONSISTENT || source.statusId === STATUS_IDS.SHIFTED
  return source.comparisonAvailable === comparisonAvailable
    ? Object.freeze({ statusId: source.statusId, comparisonAvailable })
    : null
}

export function getPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyPresentation(statusId) {
  if (statusId === STATUS_IDS.COLLECTING) return Object.freeze({
    heading: 'Consistency comparison is collecting complete periods',
    message: 'It begins only after three completed 30-day review-activity periods are available.',
    statusClass: 'text-gray-300',
  })
  if (statusId === STATUS_IDS.INSUFFICIENT_ACTIVITY) return Object.freeze({
    heading: 'Consistency comparison needs more aggregate activity',
    message: 'Each completed period needs at least 10 aggregate review activities before comparisons are shown.',
    statusClass: 'text-amber-300',
  })
  if (statusId === STATUS_IDS.CONSISTENT) return Object.freeze({
    heading: 'Review process is consistent across completed periods',
    message: 'Conclusion mix and revision rate stayed within fixed comparison bands. This is descriptive, not policy or routing authority.',
    statusClass: 'text-green-300',
  })
  if (statusId === STATUS_IDS.SHIFTED) return Object.freeze({
    heading: 'Review process changed across a completed-period comparison',
    message: 'Conclusion mix or revision rate moved outside a fixed comparison band. Review the existing aggregate tables; no action was taken automatically.',
    statusClass: 'text-amber-300',
  })
  return null
}

export { STATUS_IDS as POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS }
