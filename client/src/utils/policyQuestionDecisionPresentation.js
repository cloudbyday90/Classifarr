/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  normalizePolicyCandidateEvidenceCard,
} from './policyCandidateEvidenceCardPresentation'
import {
  normalizePolicyCandidateContrastiveEvidence,
} from './policyCandidateContrastiveEvidencePresentation'
import {
  normalizePolicyLibraryEvidenceProfile,
} from './policyLibraryEvidenceProfilePresentation'

export const POLICY_RUNTIME_QUESTION_DECISION_PRESENTATION_VERSION =
  'policy.runtime_question_decision_presentation.v1'

const CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_PRESENTATION_VERSION =
  'classification.candidate_bound_verification_presentation.v1'
const POLICY_CANDIDATE_ADJUDICATION_PRESENTATION_VERSION =
  'policy.candidate_adjudication_presentation.v1'
const POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_VERSION =
  'policy.runtime_question_score_explanation.v1'

const CANDIDATE_BOUND_VERIFICATION_STATUS_IDS = new Set([
  'admitted',
  'confirmed',
  'abstained',
  'contract_violation',
  'candidate_unavailable',
  'candidate_mismatch',
  'provider_capability_unavailable',
])
const CANDIDATE_ADJUDICATION_STATUS_IDS = new Set([
  'proposed',
  'abstained',
  'response_rejected',
])
const CANDIDATE_ADJUDICATION_SEMANTIC_RETRIEVAL_STATUS_IDS = new Set([
  'available',
  'unavailable',
])
const SCORE_EXPLANATION_SOURCE_IDS = new Set([
  'declared_policy_signal',
  'declared_policy_intent',
  'observed_library_contents',
  'confirmed_pattern',
  'similar_items',
  'prior_outcomes',
])
const SCORE_EXPLANATION_CALIBRATION_STATUS_IDS = new Set([
  'not_adjusted',
  'negative_conflict',
  'compatibility_only',
  'broad_compatibility_overlap',
  'insufficient_specialized_evidence',
  'profile_only',
  'rag_only',
  'no_positive_evidence',
  'evidence_safety_adjusted',
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

function decimalScore(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100
    ? Math.round(number * 10) / 10
    : null
}

function percentage(value, minimum = 0, maximum = 100) {
  const number = Number(value)
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? Math.round(number * 10) / 10
    : null
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

function candidateAdjudication(value) {
  if (value?.version !== POLICY_CANDIDATE_ADJUDICATION_PRESENTATION_VERSION) return null

  const statusId = boundedString(value?.status_id, 80)
  const label = boundedString(value?.label, 120)
  const message = boundedString(value?.message)
  if (!statusId || !CANDIDATE_ADJUDICATION_STATUS_IDS.has(statusId) || !label || !message) {
    return null
  }

  const semanticRetrieval = value?.semantic_retrieval
  const semanticStatusId = boundedString(semanticRetrieval?.status_id, 80)
  const semanticLabel = boundedString(semanticRetrieval?.label, 120)
  const semanticMessage = boundedString(semanticRetrieval?.message)

  return {
    status_id: statusId,
    label,
    message,
    proposed_destination: destination(value?.proposed_destination),
    semantic_retrieval: semanticStatusId &&
      CANDIDATE_ADJUDICATION_SEMANTIC_RETRIEVAL_STATUS_IDS.has(semanticStatusId) &&
      semanticLabel && semanticMessage
      ? { status_id: semanticStatusId, label: semanticLabel, message: semanticMessage }
      : null,
  }
}

function scoreExplanationComponent(value) {
  const sourceId = boundedString(value?.source_id, 80)
  const evidenceScore = score(value?.evidence_score)
  const normalizedWeightPercent = percentage(value?.normalized_weight_percent)
  const weightedContribution = decimalScore(value?.weighted_contribution)
  if (!sourceId || !SCORE_EXPLANATION_SOURCE_IDS.has(sourceId) || evidenceScore === null ||
      normalizedWeightPercent === null || weightedContribution === null) {
    return null
  }

  return {
    source_id: sourceId,
    evidence_score: evidenceScore,
    normalized_weight_percent: normalizedWeightPercent,
    weighted_contribution: weightedContribution,
  }
}

function scoreExplanation(value) {
  if (value?.version !== POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_VERSION) return null

  const displayScore = score(value?.score)
  const baseScore = decimalScore(value?.base_score)
  const agreementMultiplierPercent = percentage(value?.agreement_multiplier_percent, 100, 130)
  const calibrationStatusId = boundedString(value?.calibration?.status_id, 80)
  const preSafetyScore = value?.calibration?.pre_safety_score === null ||
    value?.calibration?.pre_safety_score === undefined
    ? null
    : score(value.calibration.pre_safety_score)
  const seenSourceIds = new Set()
  const components = (Array.isArray(value?.components) ? value.components : [])
    .map(scoreExplanationComponent)
    .filter((component) => {
      if (!component || seenSourceIds.has(component.source_id)) return false
      seenSourceIds.add(component.source_id)
      return true
    })
    .slice(0, 6)

  if (displayScore === null || baseScore === null || agreementMultiplierPercent === null ||
      !calibrationStatusId || !SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.has(calibrationStatusId) ||
      components.length === 0) {
    return null
  }

  return {
    score: displayScore,
    base_score: baseScore,
    agreement_multiplier_percent: agreementMultiplierPercent,
    components,
    calibration: {
      status_id: calibrationStatusId,
      pre_safety_score: preSafetyScore,
    },
  }
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
      candidate_evidence_card: normalizePolicyCandidateEvidenceCard(
        deterministic?.candidate_evidence_card,
      ),
      candidate_contrastive_evidence: normalizePolicyCandidateContrastiveEvidence(
        deterministic?.candidate_contrastive_evidence,
      ),
      library_evidence_profile: normalizePolicyLibraryEvidenceProfile(
        deterministic?.library_evidence_profile,
      ),
      score_explanation: scoreExplanation(deterministic?.score_explanation),
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
    candidate_adjudication: candidateAdjudication(source?.candidate_adjudication),
  }
}
