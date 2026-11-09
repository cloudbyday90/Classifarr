/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_RUNTIME_QUESTION_RECOMMENDATION_PRESENTATION_VERSION =
  'policy.runtime_question_recommendation_presentation.v2'

export const POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS = Object.freeze({
  LEADING_CANDIDATE_AVAILABLE: 'leading_candidate_available',
  MANUAL_DESTINATION_SELECTION_REQUIRED: 'manual_destination_selection_required',
})

function positiveInteger(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 && number <= 2147483647 ? number : null
}

function boundedString(value, maximumLength = 280) {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= maximumLength ? normalized : null
}

function evidenceScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null
}

function candidateDestination(value) {
  const libraryId = positiveInteger(value?.library_id)
  const libraryName = boundedString(value?.library_name, 160)
  return libraryId && libraryName ? { library_id: libraryId, library_name: libraryName } : null
}

export function policyQuestionCandidateDestinations(answer = {}) {
  const seen = new Set()

  return (Array.isArray(answer?.candidate_destinations) ? answer.candidate_destinations : [])
    .map(candidateDestination)
    .filter(destination => {
      if (!destination || seen.has(destination.library_id)) return false
      seen.add(destination.library_id)
      return true
    })
}

function candidateDestinationById(answer) {
  return new Map(policyQuestionCandidateDestinations(answer)
    .map(destination => [destination.library_id, destination]))
}

export function policyQuestionRecommendation(answer = {}) {
  const source = answer?.recommendation
  if (!source) return null
  if (source.version === POLICY_RUNTIME_QUESTION_RECOMMENDATION_PRESENTATION_VERSION) return currentRecommendation(answer)
  if (source.version !== 'policy.runtime_question_recommendation_presentation.v1') return null

  const statusId = boundedString(source.status_id, 80)
  const whyNotAutomatic = source?.why_not_automatic
  const reasonId = boundedString(whyNotAutomatic?.reason_id, 80)
  const message = boundedString(whyNotAutomatic?.message)
  if (!reasonId || !message) return null

  if (statusId === POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS.LEADING_CANDIDATE_AVAILABLE) {
    const leadingLibraryId = positiveInteger(source?.leading_destination?.library_id)
    const score = evidenceScore(source?.leading_destination?.evidence_score)
    const destination = candidateDestinationById(answer).get(leadingLibraryId)
    if (!destination || score === null) return null

    return {
      status_id: statusId,
      leading_destination: {
        ...destination,
        evidence_score: score,
      },
      why_not_automatic: {
        reason_id: reasonId,
        message,
      },
    }
  }

  if (statusId !== POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS.MANUAL_DESTINATION_SELECTION_REQUIRED ||
      source.leading_destination !== null) {
    return null
  }

  return {
    status_id: statusId,
    leading_destination: null,
    why_not_automatic: {
      reason_id: reasonId,
      message,
    },
  }
}

function currentRecommendation(answer) {
  const source = answer.recommendation
  const keys = ['version', 'status_id', 'leading_destination', 'policy_destination', 'advisory_destination', 'why_not_automatic', 'alternative_candidate_count']
  if (Object.keys(source).length !== keys.length || keys.some(key => !Object.hasOwn(source, key))) return null
  const destinations = candidateDestinationById(answer)
  if (!Array.isArray(answer.candidate_destinations) || answer.candidate_destinations.length > 64 ||
      answer.candidate_destinations.length !== destinations.size) return null
  const bind = (value, scored = false) => {
    if (value === null) return null
    const destination = destinations.get(positiveInteger(value?.library_id))
    const score = evidenceScore(value?.evidence_score)
    return destination && (!scored || score !== null) ? { ...destination, ...(scored ? { evidence_score: score } : {}) } : null
  }
  const policy = bind(source.policy_destination, true)
  const advisory = bind(source.advisory_destination)
  const leading = bind(source.leading_destination, true)
  const reasonId = boundedString(source.why_not_automatic?.reason_id, 80)
  const message = boundedString(source.why_not_automatic?.message)
  if (!reasonId || !message || [
    [source.policy_destination, policy], [source.advisory_destination, advisory], [source.leading_destination, leading],
  ].some(([raw, bound]) => raw !== null && !bound)) return null
  const hasPrimary = source.status_id === POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS.LEADING_CANDIDATE_AVAILABLE
  if (hasPrimary) {
    if (!leading || !policy || leading.library_id !== policy.library_id || leading.evidence_score !== policy.evidence_score ||
        advisory && advisory.library_id !== policy.library_id ||
        ['advisory_disagreement', 'invalid_advisory_proposal', 'policy_tie', 'policy_reference_unavailable', 'no_positive_evidence'].includes(reasonId)) return null
  } else if (source.status_id !== POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS.MANUAL_DESTINATION_SELECTION_REQUIRED || source.leading_destination !== null) return null
  if (reasonId === 'advisory_disagreement' && (!policy || !advisory || policy.library_id === advisory.library_id)) return null
  if (source.alternative_candidate_count !== destinations.size - (hasPrimary ? 1 : 0)) return null
  return {
    version: source.version,
    status_id: source.status_id,
    leading_destination: leading,
    policy_destination: policy,
    advisory_destination: advisory,
    why_not_automatic: { reason_id: reasonId, message },
  }
}

export function leadingPolicyQuestionDestination(answer) {
  return policyQuestionRecommendation(answer)?.leading_destination || null
}
