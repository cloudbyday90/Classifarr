/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE,
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS,
} from './currentLibraryCandidateSemanticRetrievalContract.mjs';

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_OBSERVATION_STATUS_IDS =
  Object.freeze({
    OUTCOME_CALIBRATED: 'outcome_calibrated',
    NOT_OUTCOME_CALIBRATED: 'not_outcome_calibrated',
    NO_SEMANTIC_MATCH: 'no_semantic_match',
  });

function boundedCount(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue)
    ? Math.max(0, Math.min(
      CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE,
      numericValue,
    ))
    : 0;
}

/**
 * Produces the one content-free calibration state that may be persisted with a
 * candidate adjudication. It distinguishes an available query with no semantic
 * item from an available query whose matched items were not outcome-calibrated.
 * Unavailable retrieval intentionally produces no state, preserving the
 * existing semantic-retrieval status as the authoritative failure boundary.
 */
export function buildCurrentLibraryCandidateSemanticOutcomeCalibrationObservation({
  statusId = null,
  candidates = [],
} = {}) {
  if (statusId !== CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.AVAILABLE) {
    return null;
  }

  let hasSemanticMatch = false;
  let hasOutcomeCalibratedMatch = false;

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const matchCount = boundedCount(candidate?.matchCount);
    const outcomeCalibratedMatchCount = Math.min(
      matchCount,
      boundedCount(candidate?.outcomeCalibratedMatchCount),
    );
    hasSemanticMatch ||= matchCount > 0;
    hasOutcomeCalibratedMatch ||= outcomeCalibratedMatchCount > 0;
  }

  if (hasOutcomeCalibratedMatch) {
    return CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_OBSERVATION_STATUS_IDS.OUTCOME_CALIBRATED;
  }
  if (hasSemanticMatch) {
    return CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_OBSERVATION_STATUS_IDS.NOT_OUTCOME_CALIBRATED;
  }
  return CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_OBSERVATION_STATUS_IDS.NO_SEMANTIC_MATCH;
}
