/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS,
} from './policyCandidateCorrectionCohortComposition.mjs';

export const POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_WINDOW_DAYS = 28;
export const POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_VERSION =
  'policy.candidate_correction_long_horizon_trend.v1';

export const POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS = Object.freeze({
  NEEDS_REPRESENTATIVE_PERIODS: 'needs_representative_periods',
  COHORT_COMPARISON_NEEDS_OBSERVATIONS: 'cohort_comparison_needs_observations',
  COHORT_MIX_SHIFT_DETECTED: 'cohort_mix_shift_detected',
  SUSTAINED_REVIEW_SIGNAL: 'sustained_review_signal',
  SUSTAINED_LOW_SIGNAL: 'sustained_low_signal',
  MIXED_SIGNAL: 'mixed_signal',
});

const CALIBRATION_STATUS_IDS = new Set([
  'insufficient_data',
  'review_recommended',
  'inconclusive',
  'no_material_signal',
]);
const COHORT_COMPOSITION_STATUS_IDS = new Set(
  Object.values(POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS),
);

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

function cohortCompositionSnapshot(value) {
  const statusId = typeof value?.statusId === 'string' ? value.statusId : null;
  return COHORT_COMPOSITION_STATUS_IDS.has(statusId) ? statusId : null;
}

function trendStatusId(current, previous, cohortCompositionStatusId) {
  if (current.statusId === 'insufficient_data' || previous.statusId === 'insufficient_data') {
    return POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS.NEEDS_REPRESENTATIVE_PERIODS;
  }
  if (cohortCompositionStatusId ===
      POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.MATERIAL_SHIFT_DETECTED) {
    return POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS.COHORT_MIX_SHIFT_DETECTED;
  }
  if (cohortCompositionStatusId ===
      POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.INSUFFICIENT_DATA) {
    return POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS.COHORT_COMPARISON_NEEDS_OBSERVATIONS;
  }
  if (current.statusId === 'review_recommended' && previous.statusId === 'review_recommended') {
    return POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS.SUSTAINED_REVIEW_SIGNAL;
  }
  if (current.statusId === 'no_material_signal' && previous.statusId === 'no_material_signal') {
    return POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS.SUSTAINED_LOW_SIGNAL;
  }
  return POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS.MIXED_SIGNAL;
}

/**
 * Compares two fixed 28-day aggregate readiness periods after checking their
 * cohort composition. It is an advisory monitoring status only: it does not
 * estimate causality, tune policy, call AI or RAG, or authorize routing.
 */
export function buildPolicyCandidateCorrectionLongHorizonTrend({
  currentCalibrationReadiness,
  previousCalibrationReadiness,
  cohortComposition,
} = {}) {
  const current = readinessSnapshot(currentCalibrationReadiness);
  const previous = readinessSnapshot(previousCalibrationReadiness);
  const cohortCompositionStatusId = cohortCompositionSnapshot(cohortComposition);
  if (!current || !previous || !cohortCompositionStatusId) {
    throw new TypeError('Valid correction readiness and cohort-composition snapshots are required.');
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_VERSION,
    statusId: trendStatusId(current, previous, cohortCompositionStatusId),
    currentStatusId: current.statusId,
    previousStatusId: previous.statusId,
    currentApplicableDecisionCount: current.applicableDecisionCount,
    previousApplicableDecisionCount: previous.applicableDecisionCount,
    cohortCompositionStatusId,
  });
}
