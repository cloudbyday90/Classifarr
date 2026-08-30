/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyConfirmationEvidenceConfidenceInterval,
} from './policyConfirmationEvidenceConfidence.mjs';

export const POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_VERSION =
  'policy.candidate_correction_calibration_readiness.v1';

export const POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS = Object.freeze({
  INSUFFICIENT_DATA: 'insufficient_data',
  REVIEW_RECOMMENDED: 'review_recommended',
  INCONCLUSIVE: 'inconclusive',
  NO_MATERIAL_SIGNAL: 'no_material_signal',
});

export const POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_MINIMUM_APPLICABLE_DECISIONS =
  20;
export const POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_REVIEW_THRESHOLD_PERCENT =
  20;

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function ratePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round(numerator / denominator * 1000) / 10;
}

/**
 * Interprets anonymous, aggregate corrected-selection counts as an advisory
 * review signal. This is not probability calibration: policy scores are not
 * probabilities. It uses a fixed 95% Wilson interval to avoid treating a
 * small observed correction rate as a precise finding.
 */
export function buildPolicyCandidateCorrectionCalibrationReadiness({
  applicableDecisionCount,
  changedSelectionOutcomeCount,
} = {}) {
  const applicableDecisions = nonnegativeCount(applicableDecisionCount);
  const changedSelections = Math.min(
    applicableDecisions,
    nonnegativeCount(changedSelectionOutcomeCount),
  );
  const changedSelectionConfidenceInterval =
    buildPolicyConfirmationEvidenceConfidenceInterval({
      successCount: changedSelections,
      observationCount: applicableDecisions,
    });
  const hasSufficientData =
    applicableDecisions >= POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_MINIMUM_APPLICABLE_DECISIONS;
  const reviewThresholdPercent =
    POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_REVIEW_THRESHOLD_PERCENT;
  const statusId = !hasSufficientData
    ? POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS.INSUFFICIENT_DATA
    : (changedSelectionConfidenceInterval?.lowerRatePercent >= reviewThresholdPercent
      ? POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS.REVIEW_RECOMMENDED
      : (changedSelectionConfidenceInterval?.upperRatePercent < reviewThresholdPercent
        ? POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS.NO_MATERIAL_SIGNAL
        : POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS.INCONCLUSIVE));

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_VERSION,
    statusId,
    applicableDecisionCount: applicableDecisions,
    changedSelectionOutcomeCount: changedSelections,
    changedSelectionRatePercent: ratePercent(changedSelections, applicableDecisions),
    minimumApplicableDecisionCount:
      POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_MINIMUM_APPLICABLE_DECISIONS,
    reviewThresholdPercent,
    changedSelectionConfidenceInterval,
  });
}
