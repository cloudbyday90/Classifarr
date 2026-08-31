/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const VERSION = 'policy.candidate_correction_policy_change_outcome_observation.v1'
const STATUS_IDS = Object.freeze({
  NOT_STARTED: 'not_started',
  OBSERVING: 'observing',
  OUTCOME_AVAILABLE: 'outcome_available',
  EXPIRED: 'expired',
})
const WILSON_Z = 1.959963984540054

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function normalizeTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null
}

function normalizeCount(value) {
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null
}

function buildWilsonInterval(successfulCount, totalCount) {
  if (!totalCount) return null
  const proportion = successfulCount / totalCount
  const zSquared = WILSON_Z ** 2
  const denominator = 1 + (zSquared / totalCount)
  const center = (proportion + (zSquared / (2 * totalCount))) / denominator
  const margin = (WILSON_Z / denominator) * Math.sqrt(
    (proportion * (1 - proportion) / totalCount) + (zSquared / (4 * totalCount ** 2)),
  )
  return Object.freeze({
    lowerBound: Math.max(0, center - margin),
    upperBound: Math.min(1, center + margin),
  })
}

function matchesWilsonInterval(value, expected) {
  if (expected === null) return value === null
  const source = asPlainObject(value)
  return source && Number.isFinite(source.lowerBound) && Number.isFinite(source.upperBound) &&
    Math.abs(source.lowerBound - expected.lowerBound) < 1e-12 &&
    Math.abs(source.upperBound - expected.upperBound) < 1e-12
}

function normalizeSummary(value) {
  const source = asPlainObject(value)
  const outcomeCount = normalizeCount(source?.outcomeCount)
  const confirmedLeaderOutcomeCount = normalizeCount(source?.confirmedLeaderOutcomeCount)
  const changedToCandidateOutcomeCount = normalizeCount(source?.changedToCandidateOutcomeCount)
  const changedOutsideCandidatesOutcomeCount = normalizeCount(source?.changedOutsideCandidatesOutcomeCount)
  const routedNotApplicableOutcomeCount = normalizeCount(source?.routedNotApplicableOutcomeCount)
  const applicableDecisionCount = normalizeCount(source?.applicableDecisionCount)
  const changedSelectionOutcomeCount = normalizeCount(source?.changedSelectionOutcomeCount)
  const changedSelectionRatePercent = Number(source?.changedSelectionRatePercent)

  if (![outcomeCount, confirmedLeaderOutcomeCount, changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount, routedNotApplicableOutcomeCount,
    applicableDecisionCount, changedSelectionOutcomeCount].every(Number.isSafeInteger) ||
    !Number.isFinite(changedSelectionRatePercent) || changedSelectionRatePercent < 0 ||
    confirmedLeaderOutcomeCount + changedToCandidateOutcomeCount +
      changedOutsideCandidatesOutcomeCount + routedNotApplicableOutcomeCount !== outcomeCount ||
    applicableDecisionCount !== confirmedLeaderOutcomeCount + changedToCandidateOutcomeCount +
      changedOutsideCandidatesOutcomeCount ||
    changedSelectionOutcomeCount !== changedToCandidateOutcomeCount + changedOutsideCandidatesOutcomeCount ||
    !matchesWilsonInterval(
      source.changedSelectionRateInterval95,
      buildWilsonInterval(changedSelectionOutcomeCount, applicableDecisionCount),
    )) {
    return null
  }

  return Object.freeze({
    outcomeCount,
    confirmedLeaderOutcomeCount,
    changedToCandidateOutcomeCount,
    changedOutsideCandidatesOutcomeCount,
    routedNotApplicableOutcomeCount,
    applicableDecisionCount,
    changedSelectionOutcomeCount,
    changedSelectionRatePercent,
    changedSelectionRateInterval95: buildWilsonInterval(changedSelectionOutcomeCount, applicableDecisionCount),
  })
}

function normalizeWindow(value) {
  const source = asPlainObject(value)
  const startAt = normalizeTimestamp(source?.startAt)
  const endAt = normalizeTimestamp(source?.endAt)
  return source && startAt && endAt && startAt < endAt
    ? Object.freeze({ startAt, endAt })
    : null
}

function normalizeObservation(value) {
  const source = asPlainObject(value)
  const hypothesisId = source?.hypothesisId
  const createdAt = normalizeTimestamp(source?.createdAt)
  const outcomeAvailableAt = normalizeTimestamp(source?.outcomeAvailableAt)
  const expiresAt = normalizeTimestamp(source?.expiresAt)
  const baselineWindow = normalizeWindow(source?.baselineWindow)
  const followupWindow = normalizeWindow(source?.followupWindow)
  const baselineSummary = normalizeSummary(source?.baselineSummary)
  if (!source || typeof hypothesisId !== 'string' || !/^pco_[A-Za-z0-9_-]{32}$/u.test(hypothesisId) ||
      !createdAt || !outcomeAvailableAt || !expiresAt || !baselineWindow || !followupWindow ||
      !baselineSummary || baselineWindow.endAt > followupWindow.startAt ||
      outcomeAvailableAt !== followupWindow.endAt || followupWindow.endAt > expiresAt) {
    return null
  }
  return Object.freeze({
    hypothesisId,
    createdAt,
    outcomeAvailableAt,
    expiresAt,
    baselineWindow,
    followupWindow,
    baselineSummary,
  })
}

function normalizeOutcome(value) {
  const source = asPlainObject(value)
  const followupSummary = normalizeSummary(source?.followupSummary)
  const changedSelectionRatePointDifference = Number(source?.changedSelectionRatePointDifference)
  if (!source || !followupSummary || source.comparisonType !== 'descriptive_only' ||
      typeof source.message !== 'string' || source.message.length > 300 ||
      !Number.isFinite(changedSelectionRatePointDifference)) return null
  return Object.freeze({ followupSummary, changedSelectionRatePointDifference, message: source.message })
}

/** Drops unknown fields before the settings view renders a server response. */
export function normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservation(value) {
  const source = asPlainObject(value)
  if (!source || source.version !== VERSION || !Object.values(STATUS_IDS).includes(source.statusId) ||
      typeof source.startAvailable !== 'boolean' || source.automaticPolicyChange !== false ||
      source.automaticAiRagTuning !== false || source.routingChanged !== false) return null

  if (source.statusId === STATUS_IDS.NOT_STARTED || source.statusId === STATUS_IDS.EXPIRED) {
    return source.observation === null && source.outcome === null
      ? Object.freeze({ statusId: source.statusId, startAvailable: source.startAvailable, observation: null, outcome: null })
      : null
  }

  const observation = normalizeObservation(source.observation)
  if (!observation) return null
  if (source.statusId === STATUS_IDS.OBSERVING && source.outcome === null) {
    return Object.freeze({ statusId: source.statusId, startAvailable: false, observation, outcome: null })
  }
  const outcome = source.statusId === STATUS_IDS.OUTCOME_AVAILABLE ? normalizeOutcome(source.outcome) : null
  return outcome ? Object.freeze({ statusId: source.statusId, startAvailable: false, observation, outcome }) : null
}

export function getPolicyCandidateCorrectionPolicyChangeOutcomeObservationPresentation(statusId) {
  if (statusId === STATUS_IDS.NOT_STARTED) return Object.freeze({
    heading: 'No policy-change follow-up is running',
    message: 'After an approved native policy change, start one aggregate observation within an hour. It never changes policy, AI, RAG, learning, or routing.',
    statusClass: 'text-gray-300',
  })
  if (statusId === STATUS_IDS.OBSERVING) return Object.freeze({
    heading: 'Policy-change follow-up is collecting completed outcomes',
    message: 'The server will make its fixed aggregate comparison available automatically after the follow-up period ends.',
    statusClass: 'text-blue-300',
  })
  if (statusId === STATUS_IDS.OUTCOME_AVAILABLE) return Object.freeze({
    heading: 'Policy-change follow-up is ready for review',
    message: 'The aggregate comparison is descriptive only; it cannot automatically tune policy, AI, RAG, learning, or routing.',
    statusClass: 'text-green-400',
  })
  if (statusId === STATUS_IDS.EXPIRED) return Object.freeze({
    heading: 'The previous policy-change follow-up expired',
    message: 'Its bounded result is no longer retained. A new approved native policy change can start a new observation.',
    statusClass: 'text-gray-400',
  })
  return null
}

export function presentPolicyCandidateCorrectionPolicyChangeOutcomeSummary(summary) {
  const normalized = normalizeSummary(summary)
  if (!normalized) return null
  return Object.freeze({
    applicableDecisionLabel: `${normalized.applicableDecisionCount} applicable ${normalized.applicableDecisionCount === 1 ? 'decision' : 'decisions'}`,
    changedSelectionRateLabel: `${normalized.changedSelectionRatePercent.toFixed(1)}%`,
    changedSelectionRateIntervalLabel: normalized.changedSelectionRateInterval95
      ? `${(normalized.changedSelectionRateInterval95.lowerBound * 100).toFixed(1)}% to ${(normalized.changedSelectionRateInterval95.upperBound * 100).toFixed(1)}%`
      : 'Not available for an empty group',
    changedSelectionLabel: `${normalized.changedSelectionOutcomeCount} changed ${normalized.changedSelectionOutcomeCount === 1 ? 'selection' : 'selections'}`,
  })
}

export { STATUS_IDS as POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_STATUS_IDS }
