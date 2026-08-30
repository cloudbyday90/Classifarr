/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_VERSION =
  'policy.candidate_correction_temporal_stability.v1';

export const POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_STATUS_IDS = Object.freeze({
  INSUFFICIENT_COMPARISON_DATA: 'insufficient_comparison_data',
  PERSISTENT_REVIEW_SIGNAL: 'persistent_review_signal',
  EMERGING_REVIEW_SIGNAL: 'emerging_review_signal',
  DIMINISHING_REVIEW_SIGNAL: 'diminishing_review_signal',
  STABLE_NO_MATERIAL_SIGNAL: 'stable_no_material_signal',
  INCONCLUSIVE: 'inconclusive',
});

const CALIBRATION_STATUS_IDS = new Set([
  'insufficient_data',
  'review_recommended',
  'inconclusive',
  'no_material_signal',
]);

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : null;
}

function readinessSnapshot(value) {
  const statusId = typeof value?.statusId === 'string' ? value.statusId : null;
  const applicableDecisionCount = nonnegativeCount(value?.applicableDecisionCount);
  if (!CALIBRATION_STATUS_IDS.has(statusId) || applicableDecisionCount === null) return null;

  return Object.freeze({ statusId, applicableDecisionCount });
}

function stabilityStatusId(currentStatusId, previousStatusId) {
  if (currentStatusId === 'insufficient_data' || previousStatusId === 'insufficient_data') {
    return POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_STATUS_IDS.INSUFFICIENT_COMPARISON_DATA;
  }
  if (currentStatusId === 'review_recommended' && previousStatusId === 'review_recommended') {
    return POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_STATUS_IDS.PERSISTENT_REVIEW_SIGNAL;
  }
  if (currentStatusId === 'review_recommended') {
    return POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_STATUS_IDS.EMERGING_REVIEW_SIGNAL;
  }
  if (previousStatusId === 'review_recommended') {
    return POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_STATUS_IDS.DIMINISHING_REVIEW_SIGNAL;
  }
  if (currentStatusId === 'no_material_signal' && previousStatusId === 'no_material_signal') {
    return POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_STATUS_IDS.STABLE_NO_MATERIAL_SIGNAL;
  }
  return POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_STATUS_IDS.INCONCLUSIVE;
}

/**
 * Compares existing count-derived readiness results. This is a persistence
 * observation, not a statistical change test, correctness verdict, or
 * authorization to alter policy, AI, RAG, learning, or routing.
 */
export function buildPolicyCandidateCorrectionTemporalStability({
  currentCalibrationReadiness,
  previousCalibrationReadiness,
} = {}) {
  const current = readinessSnapshot(currentCalibrationReadiness);
  const previous = readinessSnapshot(previousCalibrationReadiness);
  if (!current || !previous) {
    throw new TypeError('Valid correction calibration-readiness snapshots are required.');
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_VERSION,
    statusId: stabilityStatusId(current.statusId, previous.statusId),
    currentStatusId: current.statusId,
    previousStatusId: previous.statusId,
    currentApplicableDecisionCount: current.applicableDecisionCount,
    previousApplicableDecisionCount: previous.applicableDecisionCount,
  });
}
