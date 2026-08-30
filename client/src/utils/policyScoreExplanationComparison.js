/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_SCORE_EXPLANATION_COMPARISON_MAXIMUM_ENTRIES = 3

export const POLICY_SCORE_EXPLANATION_SOURCE_IDS = Object.freeze([
  'declared_policy_signal',
  'declared_policy_intent',
  'observed_library_contents',
  'confirmed_pattern',
  'similar_items',
  'prior_outcomes',
])

export const POLICY_SCORE_EXPLANATION_SOURCE_LABELS = Object.freeze({
  declared_policy_signal: 'Declared policy signal',
  declared_policy_intent: 'Declared policy intent',
  observed_library_contents: 'Observed library contents',
  confirmed_pattern: 'Confirmed pattern',
  similar_items: 'Similar items (RAG)',
  prior_outcomes: 'Prior outcomes',
})

export const POLICY_SCORE_EXPLANATION_CALIBRATION_LABELS = Object.freeze({
  not_adjusted: 'No evidence-safety calibration changed this score.',
  negative_conflict: 'Evidence-safety calibration reduced this score because evidence conflicts.',
  compatibility_only: 'Evidence-safety calibration reduced this compatibility-only score.',
  broad_compatibility_overlap: 'Evidence-safety calibration reduced this score because the match is broadly compatible.',
  insufficient_specialized_evidence: 'Evidence-safety calibration reduced this score because specialized evidence is limited.',
  profile_only: 'Evidence-safety calibration reduced this profile-only score.',
  rag_only: 'Evidence-safety calibration reduced this RAG-only score.',
  no_positive_evidence: 'Evidence-safety calibration reduced this score because no positive evidence was available.',
  evidence_safety_adjusted: 'Evidence-safety calibration adjusted this score.',
})

const sourceIdSet = new Set(POLICY_SCORE_EXPLANATION_SOURCE_IDS)
const calibrationStatusIdSet = new Set(Object.keys(POLICY_SCORE_EXPLANATION_CALIBRATION_LABELS))

function integerScore(value) {
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

function normalizedComponent(value, seenSourceIds) {
  const sourceId = value?.source_id
  const evidenceScore = integerScore(value?.evidence_score)
  const normalizedWeightPercent = percentage(value?.normalized_weight_percent)
  const weightedContribution = decimalScore(value?.weighted_contribution)

  if (typeof sourceId !== 'string' || !sourceIdSet.has(sourceId) || seenSourceIds.has(sourceId) ||
      evidenceScore === null || normalizedWeightPercent === null || weightedContribution === null) {
    return null
  }

  seenSourceIds.add(sourceId)
  return {
    source_id: sourceId,
    evidence_score: evidenceScore,
    normalized_weight_percent: normalizedWeightPercent,
    weighted_contribution: weightedContribution,
  }
}

/**
 * Revalidates the already allow-listed decision presentation before it enters
 * a local comparison. The returned entry intentionally excludes item,
 * library, policy, provider, prompt, response, and routing data.
 */
export function policyScoreExplanationComparisonEntry(decisionPresentation = {}) {
  const deterministic = decisionPresentation?.deterministic
  const explanation = deterministic?.score_explanation
  const score = integerScore(explanation?.score)
  const baseScore = decimalScore(explanation?.base_score)
  const agreementMultiplierPercent = percentage(explanation?.agreement_multiplier_percent, 100, 130)
  const calibrationStatusId = explanation?.calibration?.status_id
  const suppliedPreSafetyScore = explanation?.calibration?.pre_safety_score
  const preSafetyScore = suppliedPreSafetyScore === null || suppliedPreSafetyScore === undefined
    ? null
    : integerScore(suppliedPreSafetyScore)
  const seenSourceIds = new Set()
  const suppliedComponents = Array.isArray(explanation?.components) ? explanation.components : []
  const components = suppliedComponents
    .map(component => normalizedComponent(component, seenSourceIds))

  if (score === null || baseScore === null || agreementMultiplierPercent === null ||
      typeof calibrationStatusId !== 'string' || !calibrationStatusIdSet.has(calibrationStatusId) ||
      suppliedComponents.length === 0 ||
      suppliedComponents.length > POLICY_SCORE_EXPLANATION_SOURCE_IDS.length ||
      (suppliedPreSafetyScore !== null && suppliedPreSafetyScore !== undefined && preSafetyScore === null) ||
      components.some(component => component === null)) {
    return null
  }

  return {
    score,
    base_score: baseScore,
    agreement_multiplier_percent: agreementMultiplierPercent,
    review_threshold: integerScore(deterministic?.review_threshold),
    automatic_threshold: integerScore(deterministic?.automatic_threshold),
    components,
    calibration: {
      status_id: calibrationStatusId,
      pre_safety_score: preSafetyScore,
    },
  }
}

/**
 * Builds a capped, content-free comparison from the decision presentations
 * already visible to the operator. It has no persistence or mutation path.
 */
export function buildPolicyScoreExplanationComparison(decisionPresentations = []) {
  const entries = (Array.isArray(decisionPresentations) ? decisionPresentations : [])
    .map(policyScoreExplanationComparisonEntry)
    .filter(Boolean)
    .slice(0, POLICY_SCORE_EXPLANATION_COMPARISON_MAXIMUM_ENTRIES)

  if (entries.length < 2) return null

  const scores = entries.map(entry => entry.score)
  const sourceCoverage = POLICY_SCORE_EXPLANATION_SOURCE_IDS
    .map((sourceId) => ({
      source_id: sourceId,
      selected_explanation_count: entries.filter(entry => entry.components.some(
        component => component.source_id === sourceId,
      )).length,
    }))
    .filter(source => source.selected_explanation_count > 0)

  return {
    selected_explanation_count: entries.length,
    score_range: {
      minimum: Math.min(...scores),
      maximum: Math.max(...scores),
    },
    entries,
    source_coverage: sourceCoverage,
  }
}
