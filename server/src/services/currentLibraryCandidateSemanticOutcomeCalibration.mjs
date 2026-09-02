/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_VERSION =
  'current_library.candidate_semantic_outcome_calibration.v1';

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_MINIMUM_RELEVANCE = 50;
export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_MAXIMUM_BOOST = 6;

function boundedRelevance(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.min(100, Math.round(numericValue))) : 0;
}

function hasAuthorizedOutcome(value) {
  return value === true || value === 'true' || value === 't' || value === 1 || value === '1';
}

/**
 * Gives an already-relevant semantic match a small, bounded advisory boost
 * only when its synchronized history row has an authenticated, append-only
 * final-outcome receipt. This is deliberately not a policy score, confidence,
 * threshold, or route decision; callers may use it only inside the bounded
 * current-library semantic comparison.
 */
export function calibrateCurrentLibraryCandidateSemanticOutcome({
  relevance = 0,
  hasAuthorizedOutcome: rawAuthorizedOutcome = false,
} = {}) {
  const baseRelevance = boundedRelevance(relevance);
  const authorizedOutcome = hasAuthorizedOutcome(rawAuthorizedOutcome);
  const outcomeCalibrated = authorizedOutcome &&
    baseRelevance >= CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_MINIMUM_RELEVANCE;
  const boost = outcomeCalibrated
    ? CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_MAXIMUM_BOOST
    : 0;

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_VERSION,
    relevance: Math.min(100, baseRelevance + boost),
    outcomeCalibrated,
  });
}
