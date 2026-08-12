/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_RUNTIME_QUESTION_DECISION_PRESENTATION_VERSION =
  'policy.runtime_question_decision_presentation.v1'

const CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_PRESENTATION_VERSION =
  'classification.candidate_bound_verification_presentation.v1'

const CANDIDATE_BOUND_VERIFICATION_STATUS_IDS = new Set([
  'admitted',
  'confirmed',
  'abstained',
  'contract_violation',
  'candidate_unavailable',
  'candidate_mismatch',
  'provider_capability_unavailable',
])

function boundedString(value, maximumLength = 280) {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= maximumLength ? normalized : null
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function score(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 100 ? number : null
}

function destination(value) {
  const libraryId = positiveInteger(value?.library_id)
  const libraryName = boundedString(value?.library_name, 160)
  return libraryId && libraryName ? { library_id: libraryId, library_name: libraryName } : null
}

function evidence(value) {
  const id = boundedString(value?.id, 80)
  const label = boundedString(value?.label, 220)
  return id && label ? { id, label } : null
}

function safetyGate(value) {
  const id = boundedString(value?.id, 80)
  const label = boundedString(value?.label, 120)
  const message = boundedString(value?.message)
  return id && label && message ? { id, label, message } : null
}

function candidateBoundVerification(value) {
  if (value?.version !== CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_PRESENTATION_VERSION) {
    return null
  }

  const statusId = boundedString(value?.status_id, 80)
  const label = boundedString(value?.label, 120)
  const message = boundedString(value?.message)
  if (!statusId || !CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.has(statusId) || !label || !message) {
    return null
  }

  return { status_id: statusId, label, message }
}

export function policyQuestionDecisionPresentation(answer = {}) {
  const source = answer?.decision_summary
  if (source?.version !== POLICY_RUNTIME_QUESTION_DECISION_PRESENTATION_VERSION) return null

  const deterministic = source?.deterministic
  const statusId = boundedString(deterministic?.status_id, 80)
  const message = boundedString(deterministic?.message)
  if (!statusId || !message) return null

  const advisory = source?.ai_advisory
  const advisoryStatusId = boundedString(advisory?.status_id, 80)
  const advisoryMessage = boundedString(advisory?.message)

  return {
    deterministic: {
      status_id: statusId,
      destination: destination(deterministic?.destination),
      score: score(deterministic?.score),
      review_threshold: score(deterministic?.review_threshold),
      automatic_threshold: score(deterministic?.automatic_threshold),
      message,
      evidence: (Array.isArray(deterministic?.evidence) ? deterministic.evidence : [])
        .map(evidence)
        .filter(Boolean)
        .slice(0, 4),
      safety_gate: safetyGate(deterministic?.safety_gate),
      additional_safety_gates: (Array.isArray(deterministic?.additional_safety_gates)
        ? deterministic.additional_safety_gates
        : [])
        .map(safetyGate)
        .filter(Boolean)
        .slice(0, 3),
    },
    ai_advisory: advisoryStatusId && advisoryMessage
      ? {
          status_id: advisoryStatusId,
          message: advisoryMessage,
          proposed_destination: destination(advisory?.proposed_destination),
        }
      : null,
    candidate_bound_verification: candidateBoundVerification(source?.candidate_bound_verification),
  }
}
