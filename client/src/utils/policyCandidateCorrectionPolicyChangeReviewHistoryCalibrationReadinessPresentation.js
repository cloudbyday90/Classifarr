const STATUS_IDS = Object.freeze({
  COLLECTING_PERIODS: 'collecting_periods',
  INSUFFICIENT_ACTIVITY: 'insufficient_activity',
  READY_FOR_HUMAN_REVIEW: 'ready_for_human_review',
})

const EXPECTED_REVIEW_ELIGIBILITY = Object.freeze({
  [STATUS_IDS.COLLECTING_PERIODS]: false,
  [STATUS_IDS.INSUFFICIENT_ACTIVITY]: false,
  [STATUS_IDS.READY_FOR_HUMAN_REVIEW]: true,
})

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

/** Drops unknown fields and rejects any readiness state that claims authority. */
export function normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadiness(value) {
  const source = asPlainObject(value)
  if (!source || !Object.hasOwn(EXPECTED_REVIEW_ELIGIBILITY, source.statusId) ||
      source.reviewEligible !== EXPECTED_REVIEW_ELIGIBILITY[source.statusId] ||
      source.automaticPolicyChange !== false || source.automaticAiRagTuning !== false ||
      source.routingChanged !== false) {
    return null
  }
  return Object.freeze({ statusId: source.statusId, reviewEligible: source.reviewEligible })
}

const PRESENTATION = Object.freeze({
  [STATUS_IDS.COLLECTING_PERIODS]: Object.freeze({
    heading: 'Calibration review is collecting complete periods',
    message: 'It becomes available after six completed 30-day aggregate periods. No threshold can change while the history is collecting.',
    statusClass: 'text-gray-300',
  }),
  [STATUS_IDS.INSUFFICIENT_ACTIVITY]: Object.freeze({
    heading: 'Calibration review needs more aggregate activity',
    message: 'Each of the six completed periods needs at least 10 aggregate review activities before a human evaluation is meaningful.',
    statusClass: 'text-amber-300',
  }),
  [STATUS_IDS.READY_FOR_HUMAN_REVIEW]: Object.freeze({
    heading: 'Calibration review is ready for human evaluation',
    message: 'A human may now evaluate the fixed consistency bands with aggregate and synthetic fixtures. This does not tune policy, AI, RAG, or routing.',
    statusClass: 'text-blue-300',
  }),
})

export function getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessPresentation(statusId) {
  return PRESENTATION[statusId] || null
}

export { STATUS_IDS as POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS }
