/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_RUNTIME_QUESTION_RECOMMENDATION_PRESENTATION_VERSION =
  'policy.runtime_question_recommendation_presentation.v1'

export const POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS = Object.freeze({
  LEADING_CANDIDATE_AVAILABLE: 'leading_candidate_available',
  MANUAL_DESTINATION_SELECTION_REQUIRED: 'manual_destination_selection_required',
})

function positiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function boundedString(value, maximumLength = 280) {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= maximumLength ? normalized : null
}

function evidenceScore(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 100 ? number : null
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
  if (!source || source.version !== POLICY_RUNTIME_QUESTION_RECOMMENDATION_PRESENTATION_VERSION) return null

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

export function leadingPolicyQuestionDestination(answer) {
  return policyQuestionRecommendation(answer)?.leading_destination || null
}
