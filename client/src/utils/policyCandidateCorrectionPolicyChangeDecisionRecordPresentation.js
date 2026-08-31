/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const VERSION = 'policy.candidate_correction_policy_change_decision_record.v1'

const STATUS_IDS = Object.freeze({
  OUTCOME_NOT_READY: 'outcome_not_ready',
  REVIEW_READY: 'review_ready',
  DECISION_RECORDED: 'decision_recorded',
  EXPIRED: 'expired',
})

export const POLICY_CHANGE_DECISION_OPTIONS = Object.freeze([
  Object.freeze({ id: 'retain_current_policy', label: 'Retain the current policy' }),
  Object.freeze({ id: 'investigate_policy_evidence', label: 'Investigate policy evidence' }),
  Object.freeze({ id: 'prepare_manual_policy_change', label: 'Prepare a separate manual policy change' }),
])

export const POLICY_CHANGE_DECISION_RATIONALE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'outcome_improved', label: 'The aggregate outcome improved' }),
  Object.freeze({ id: 'outcome_unchanged_or_inconclusive', label: 'The aggregate outcome was unchanged or inconclusive' }),
  Object.freeze({ id: 'outcome_degraded', label: 'The aggregate outcome degraded' }),
  Object.freeze({ id: 'requires_contextual_review', label: 'Context outside this aggregate needs review' }),
])

const DECISION_IDS = POLICY_CHANGE_DECISION_OPTIONS.map(option => option.id)
const RATIONALE_IDS = POLICY_CHANGE_DECISION_RATIONALE_OPTIONS.map(option => option.id)
const HYPOTHESIS_ID_PATTERN = /^pco_[A-Za-z0-9_-]{32}$/u

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function normalizeTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null
}

function normalizePositiveInteger(value) {
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

function normalizeObservation(value) {
  const source = asPlainObject(value)
  const hypothesisId = source?.hypothesisId
  const outcomeAvailableAt = normalizeTimestamp(source?.outcomeAvailableAt)
  const expiresAt = normalizeTimestamp(source?.expiresAt)
  if (!source || !HYPOTHESIS_ID_PATTERN.test(hypothesisId || '') || !outcomeAvailableAt || !expiresAt ||
      outcomeAvailableAt > expiresAt) return null
  return Object.freeze({ hypothesisId, outcomeAvailableAt, expiresAt })
}

function normalizeDecision(value, observation) {
  const source = asPlainObject(value)
  const decisionId = source?.decisionId
  const rationaleId = source?.rationaleId
  const revision = normalizePositiveInteger(source?.revision)
  const createdAt = normalizeTimestamp(source?.createdAt)
  const updatedAt = normalizeTimestamp(source?.updatedAt)
  const expiresAt = normalizeTimestamp(source?.expiresAt)
  if (!source || !DECISION_IDS.includes(decisionId) || !RATIONALE_IDS.includes(rationaleId) || !revision ||
      !createdAt || !updatedAt || !expiresAt || createdAt > updatedAt || updatedAt > expiresAt ||
      expiresAt !== observation?.expiresAt) return null
  return Object.freeze({ decisionId, rationaleId, revision, createdAt, updatedAt, expiresAt })
}

/** Drops unknown fields before the automatic Security Settings card renders a response. */
export function normalizePolicyCandidateCorrectionPolicyChangeDecisionRecord(value) {
  const source = asPlainObject(value)
  if (!source || source.version !== VERSION || !Object.values(STATUS_IDS).includes(source.statusId) ||
      typeof source.reviewAvailable !== 'boolean' || source.automaticPolicyChange !== false ||
      source.automaticAiRagTuning !== false || source.routingChanged !== false) return null

  if (source.statusId === STATUS_IDS.OUTCOME_NOT_READY || source.statusId === STATUS_IDS.EXPIRED) {
    return source.reviewAvailable === false && source.observation === null && source.decision === null
      ? Object.freeze({ statusId: source.statusId, reviewAvailable: false, observation: null, decision: null })
      : null
  }

  const observation = normalizeObservation(source.observation)
  if (!observation || source.reviewAvailable !== true) return null
  if (source.statusId === STATUS_IDS.REVIEW_READY && source.decision === null) {
    return Object.freeze({ statusId: source.statusId, reviewAvailable: true, observation, decision: null })
  }
  const decision = source.statusId === STATUS_IDS.DECISION_RECORDED
    ? normalizeDecision(source.decision, observation)
    : null
  return decision
    ? Object.freeze({ statusId: source.statusId, reviewAvailable: true, observation, decision })
    : null
}

export function getPolicyCandidateCorrectionPolicyChangeDecisionRecordPresentation(statusId) {
  if (statusId === STATUS_IDS.OUTCOME_NOT_READY) return Object.freeze({
    heading: 'Reviewed decision will become available automatically',
    message: 'Finish the fixed aggregate policy-change follow-up first. This card cannot change policy, AI, RAG, or routing.',
    statusClass: 'text-gray-300',
  })
  if (statusId === STATUS_IDS.REVIEW_READY) return Object.freeze({
    heading: 'Aggregate outcome is ready for a reviewed decision',
    message: 'Select a conclusion and rationale, then explicitly confirm your review. This does not apply a policy change.',
    statusClass: 'text-green-400',
  })
  if (statusId === STATUS_IDS.DECISION_RECORDED) return Object.freeze({
    heading: 'Reviewed decision recorded',
    message: 'You may revise the bounded conclusion while this aggregate outcome remains readable. No automatic change was made.',
    statusClass: 'text-blue-300',
  })
  if (statusId === STATUS_IDS.EXPIRED) return Object.freeze({
    heading: 'Reviewed decision window expired',
    message: 'The related aggregate outcome is no longer retained. No policy, AI, RAG, or routing change was made.',
    statusClass: 'text-gray-400',
  })
  return null
}

export { STATUS_IDS as POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_STATUS_IDS }
