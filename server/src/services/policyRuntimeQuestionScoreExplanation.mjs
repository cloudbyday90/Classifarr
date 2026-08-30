/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_VERSION =
  'policy.runtime_question_score_explanation.v1';

export const POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_SOURCE_IDS = Object.freeze({
  DECLARED_POLICY_SIGNAL: 'declared_policy_signal',
  DECLARED_POLICY_INTENT: 'declared_policy_intent',
  OBSERVED_LIBRARY_CONTENTS: 'observed_library_contents',
  CONFIRMED_PATTERN: 'confirmed_pattern',
  SIMILAR_ITEMS: 'similar_items',
  PRIOR_OUTCOMES: 'prior_outcomes',
});

export const POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS = Object.freeze({
  NOT_ADJUSTED: 'not_adjusted',
  NEGATIVE_CONFLICT: 'negative_conflict',
  COMPATIBILITY_ONLY: 'compatibility_only',
  BROAD_COMPATIBILITY_OVERLAP: 'broad_compatibility_overlap',
  INSUFFICIENT_SPECIALIZED_EVIDENCE: 'insufficient_specialized_evidence',
  PROFILE_ONLY: 'profile_only',
  RAG_ONLY: 'rag_only',
  NO_POSITIVE_EVIDENCE: 'no_positive_evidence',
  EVIDENCE_SAFETY_ADJUSTED: 'evidence_safety_adjusted',
});

const MAX_COMPONENTS = 6;
const MAX_AGREEMENT_MULTIPLIER_PERCENT = 130;

const SOURCE_BY_BREAKDOWN_TYPE = Object.freeze({
  preset: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_SOURCE_IDS.DECLARED_POLICY_SIGNAL,
  native_intent: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_SOURCE_IDS.DECLARED_POLICY_INTENT,
  profile: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_SOURCE_IDS.OBSERVED_LIBRARY_CONTENTS,
  pattern: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_SOURCE_IDS.CONFIRMED_PATTERN,
  rag: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_SOURCE_IDS.SIMILAR_ITEMS,
  history: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_SOURCE_IDS.PRIOR_OUTCOMES,
});

const CALIBRATION_STATUS_BY_REASON_CODE = Object.freeze({
  negative_conflict: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.NEGATIVE_CONFLICT,
  compatibility_only: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.COMPATIBILITY_ONLY,
  broad_compatibility_overlap: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.BROAD_COMPATIBILITY_OVERLAP,
  insufficient_specialized_evidence: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.INSUFFICIENT_SPECIALIZED_EVIDENCE,
  profile_only: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.PROFILE_ONLY,
  rag_only: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.RAG_ONLY,
  no_positive_evidence: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.NO_POSITIVE_EVIDENCE,
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function round(value, decimalPlaces = 1) {
  const multiplier = 10 ** decimalPlaces;
  return Math.round(value * multiplier) / multiplier;
}

function score(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100
    ? Math.round(number)
    : null;
}

function activeWeight(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1 ? number : null;
}

function contributingComponents(breakdown) {
  const seenSourceIds = new Set();

  return asArray(breakdown)
    .map((entry) => {
      const sourceId = SOURCE_BY_BREAKDOWN_TYPE[entry?.type];
      const evidenceScore = score(entry?.score);
      const weight = activeWeight(entry?.activeWeight);
      if (!sourceId || evidenceScore === null || !weight || seenSourceIds.has(sourceId)) {
        return null;
      }

      seenSourceIds.add(sourceId);
      return { source_id: sourceId, evidence_score: evidenceScore, active_weight: weight };
    })
    .filter(Boolean)
    .slice(0, MAX_COMPONENTS);
}

function agreementMultiplierPercent(componentCount) {
  const multipliers = [100, 100, 105, 112, 120, 130];
  return multipliers[Math.min(componentCount, multipliers.length - 1)];
}

function calibrationPresentation(candidate, displayedScore) {
  const diagnostics = asObject(candidate?.candidate_diagnostics || candidate?.candidateDiagnostics);
  const calibration = asObject(diagnostics.score_calibration || diagnostics.scoreCalibration);
  if (calibration.applied !== true) {
    return {
      status_id: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.NOT_ADJUSTED,
      pre_safety_score: null,
    };
  }

  const preSafetyScore = score(calibration.raw_score ?? calibration.rawScore);
  const calibratedScore = score(calibration.calibrated_score ?? calibration.calibratedScore);
  const reasonCode = typeof calibration.reason_code === 'string'
    ? calibration.reason_code
    : calibration.reasonCode;

  return {
    status_id: CALIBRATION_STATUS_BY_REASON_CODE[reasonCode] ||
      POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS.EVIDENCE_SAFETY_ADJUSTED,
    pre_safety_score: preSafetyScore === null || calibratedScore === null ||
      Math.round(calibratedScore) !== displayedScore
      ? null
      : preSafetyScore,
  };
}

/**
 * Produces a bounded, deterministic explanation of the existing policy score.
 * It deliberately excludes policy terms, media metadata, policy/library IDs,
 * provider state, prompts, model output, and routing controls. The component
 * list contains only fixed source categories and normalized numeric facts
 * already used by the policy-engine formula.
 */
export function buildPolicyRuntimeQuestionScoreExplanation({
  candidate = null,
  displayedScore = null,
} = {}) {
  const safeDisplayedScore = score(displayedScore ?? candidate?.score);
  const components = contributingComponents(candidate?.breakdown);
  if (safeDisplayedScore === null || components.length === 0) {
    return null;
  }

  const totalActiveWeight = components.reduce((total, component) => (
    total + component.active_weight
  ), 0);
  if (!Number.isFinite(totalActiveWeight) || totalActiveWeight <= 0) {
    return null;
  }

  const normalizedComponents = components.map((component) => {
    const normalizedWeight = component.active_weight / totalActiveWeight;
    return {
      source_id: component.source_id,
      evidence_score: component.evidence_score,
      normalized_weight_percent: round(normalizedWeight * 100),
      weighted_contribution: round(component.evidence_score * normalizedWeight),
    };
  });
  const baseScore = round(normalizedComponents.reduce((total, component) => (
    total + component.weighted_contribution
  ), 0));
  const multiplierPercent = agreementMultiplierPercent(normalizedComponents.length);

  return {
    version: POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_VERSION,
    score: safeDisplayedScore,
    base_score: baseScore,
    agreement_multiplier_percent: Math.min(multiplierPercent, MAX_AGREEMENT_MULTIPLIER_PERCENT),
    components: normalizedComponents,
    calibration: calibrationPresentation(candidate, safeDisplayedScore),
  };
}
