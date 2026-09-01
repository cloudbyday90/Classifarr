/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER,
} from './policyCandidateCorrectionSignalSnapshot.mjs';
import {
  buildPolicyCandidateCorrectionCalibrationReadiness,
  POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS,
} from './policyCandidateCorrectionCalibrationReadiness.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_STATUS_IDS,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_VERSION,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
} from './policyCandidateCorrectionRepresentativeReviewCorpusVocabulary.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_VERSION =
  'policy.candidate_correction_representative_review_corpus_capture_calibration_report.v1';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_STATUS_IDS = Object.freeze({
  COLLECTING: 'collecting',
  REPORT_AVAILABLE: 'report_available',
});

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_RECOMMENDATION_IDS = Object.freeze({
  CONTINUE_OBSERVING: 'continue_observing',
  REVIEW_CLOSE_CANDIDATE_BOUNDARIES: 'review_close_candidate_boundaries',
  REVIEW_HIGH_MARGIN_CANDIDATE_EVIDENCE: 'review_high_margin_candidate_evidence',
  REVIEW_MIXED_SCORE_BAND_EVIDENCE: 'review_mixed_score_band_evidence',
});

const SELECTION_STATUS_IDS = Object.freeze(Object.values(
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
));
const LOW_MARGIN_BAND_IDS = new Set(['0_to_4', '5_to_14']);
const HIGH_MARGIN_BAND_IDS = new Set(['15_to_29', '30_or_more']);
const EXPECTED_AUTOMATIC_ACTION_IDS = Object.freeze([
  'aiInvocation', 'learning', 'policyChange', 'ragTuning', 'retry', 'routing',
]);

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeCount(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function ratePercent(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function hasExpectedEvaluationAuthority(value) {
  const source = asPlainObject(value);
  const automaticActions = asPlainObject(source?.automaticActions);
  return source?.scope === 'offline_evaluation_only' &&
    source.historicalRecordAccess === false && source.retainedItemAccess === false &&
    automaticActions && Object.keys(automaticActions).length === EXPECTED_AUTOMATIC_ACTION_IDS.length &&
    EXPECTED_AUTOMATIC_ACTION_IDS.every(key => automaticActions[key] === false);
}

function normalizeSelectionOutcomeCounts(value, expectedCapturedOutcomeCount) {
  if (!Array.isArray(value) || value.length !== SELECTION_STATUS_IDS.length) return null;

  const countByStatusId = new Map();
  for (const entry of value) {
    const source = asPlainObject(entry);
    const captureCount = normalizeCount(source?.captureCount);
    if (!source || !SELECTION_STATUS_IDS.includes(source.selectionStatusId) ||
        captureCount === null || countByStatusId.has(source.selectionStatusId)) {
      return null;
    }
    countByStatusId.set(source.selectionStatusId, captureCount);
  }

  if (countByStatusId.size !== SELECTION_STATUS_IDS.length ||
      [...countByStatusId.values()].reduce((total, count) => total + count, 0) !== expectedCapturedOutcomeCount) {
    return null;
  }
  return countByStatusId;
}

function normalizeMarginCoverage(value) {
  if (!Array.isArray(value) || value.length !== POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.length) return null;

  const normalized = value.map((entry, index) => {
    const source = asPlainObject(entry);
    const capturedOutcomeCount = normalizeCount(source?.capturedOutcomeCount);
    const confirmedCandidateCount = normalizeCount(source?.confirmedCandidateCount);
    const changedSelectionCount = normalizeCount(source?.changedSelectionCount);
    if (!source || source.scoreMarginBandId !== POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER[index] ||
        capturedOutcomeCount === null || confirmedCandidateCount === null || changedSelectionCount === null ||
        confirmedCandidateCount > capturedOutcomeCount || changedSelectionCount > capturedOutcomeCount ||
        source.minimumCapturedOutcomeCount !== 6 ||
        source.minimumSatisfied !== (capturedOutcomeCount >= 6) ||
        source.confirmedCandidateRate !== (capturedOutcomeCount > 0
          ? confirmedCandidateCount / capturedOutcomeCount
          : null)) {
      return null;
    }

    const outcomeCounts = normalizeSelectionOutcomeCounts(
      source.selectionOutcomeCounts,
      capturedOutcomeCount,
    );
    const expectedChangedSelectionCount =
      (outcomeCounts?.get(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_TO_CANDIDATE) || 0) +
      (outcomeCounts?.get(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_OUTSIDE_CANDIDATES) || 0);
    if (!outcomeCounts || expectedChangedSelectionCount !== changedSelectionCount ||
        outcomeCounts.get(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CONFIRMED_CANDIDATE) !== confirmedCandidateCount) {
      return null;
    }

    return Object.freeze({
      scoreMarginBandId: source.scoreMarginBandId,
      capturedOutcomeCount,
      confirmedCandidateCount,
      changedSelectionCount,
    });
  });

  return normalized.some(entry => entry === null) ? null : Object.freeze(normalized);
}

function normalizeCaptureEvaluation(value) {
  const source = asPlainObject(value);
  const report = asPlainObject(source?.report);
  const capturedOutcomeCount = normalizeCount(report?.capturedOutcomeCount);
  const minimumCapturedOutcomeCount = normalizeCount(report?.minimumCapturedOutcomeCount);
  const scoreMarginCoverage = normalizeMarginCoverage(report?.scoreMarginCoverage);
  const isReady = scoreMarginCoverage?.every(entry => entry.capturedOutcomeCount >= 6);
  if (!source || source.version !== POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_VERSION ||
      source.purposeId !== POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID ||
      source.automaticFutureCapture !== true || !hasExpectedEvaluationAuthority(source.authority) ||
      !Object.values(POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_STATUS_IDS)
        .includes(source.statusId) ||
      !report || capturedOutcomeCount === null || minimumCapturedOutcomeCount !== 24 ||
      !scoreMarginCoverage ||
      scoreMarginCoverage.reduce((total, entry) => total + entry.capturedOutcomeCount, 0) !== capturedOutcomeCount ||
      (source.statusId === POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_STATUS_IDS.READY_FOR_HUMAN_EVALUATION) !== isReady) {
    return null;
  }

  return Object.freeze({
    statusId: source.statusId,
    capturedOutcomeCount,
    minimumCapturedOutcomeCount,
    scoreMarginCoverage,
  });
}

function buildAuthority() {
  return Object.freeze({
    scope: 'offline_calibration_review_only',
    historicalRecordAccess: false,
    retainedItemAccess: false,
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      ragTuning: false,
      retry: false,
      routing: false,
    }),
  });
}

function buildBandSummary(coverage) {
  const calibrationReadiness = buildPolicyCandidateCorrectionCalibrationReadiness({
    applicableDecisionCount: coverage.capturedOutcomeCount,
    changedSelectionOutcomeCount: coverage.changedSelectionCount,
  });
  return Object.freeze({
    scoreMarginBandId: coverage.scoreMarginBandId,
    capturedOutcomeCount: coverage.capturedOutcomeCount,
    confirmedCandidateCount: coverage.confirmedCandidateCount,
    changedSelectionCount: coverage.changedSelectionCount,
    confirmationRatePercent: ratePercent(
      coverage.confirmedCandidateCount,
      coverage.capturedOutcomeCount,
    ),
    calibrationReadiness,
  });
}

function buildRecommendation(scoreMarginBands) {
  const reviewBandIds = scoreMarginBands
    .filter(band => band.calibrationReadiness.statusId ===
      POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS.REVIEW_RECOMMENDED)
    .map(band => band.scoreMarginBandId);
  const hasLowMarginReview = reviewBandIds.some(bandId => LOW_MARGIN_BAND_IDS.has(bandId));
  const hasHighMarginReview = reviewBandIds.some(bandId => HIGH_MARGIN_BAND_IDS.has(bandId));
  const recommendationId = hasLowMarginReview && hasHighMarginReview
    ? POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_RECOMMENDATION_IDS.REVIEW_MIXED_SCORE_BAND_EVIDENCE
    : hasLowMarginReview
      ? POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_RECOMMENDATION_IDS.REVIEW_CLOSE_CANDIDATE_BOUNDARIES
      : hasHighMarginReview
        ? POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_RECOMMENDATION_IDS.REVIEW_HIGH_MARGIN_CANDIDATE_EVIDENCE
        : POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_RECOMMENDATION_IDS.CONTINUE_OBSERVING;

  return Object.freeze({ recommendationId, reviewBandIds: Object.freeze(reviewBandIds) });
}

/**
 * Converts the existing automatic-capture aggregate into a fixed calibration
 * report. The thresholds describe where a human should inspect policy and
 * retrieval evidence; they never become routing, AI, RAG, or learning input.
 */
export function buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportReadModel({
  captureEvaluation,
} = {}) {
  const normalizedEvaluation = normalizeCaptureEvaluation(captureEvaluation);
  if (!normalizedEvaluation) {
    throw new TypeError('Future capture evaluation read model is invalid.');
  }

  if (normalizedEvaluation.statusId ===
      POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_STATUS_IDS.COLLECTING) {
    return Object.freeze({
      version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_VERSION,
      statusId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_STATUS_IDS.COLLECTING,
      purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
      authority: buildAuthority(),
      report: null,
    });
  }

  const scoreMarginBands = Object.freeze(normalizedEvaluation.scoreMarginCoverage.map(buildBandSummary));
  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_VERSION,
    statusId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_STATUS_IDS.REPORT_AVAILABLE,
    purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
    authority: buildAuthority(),
    report: Object.freeze({
      capturedOutcomeCount: normalizedEvaluation.capturedOutcomeCount,
      minimumCapturedOutcomeCount: normalizedEvaluation.minimumCapturedOutcomeCount,
      scoreMarginBands,
      recommendation: buildRecommendation(scoreMarginBands),
    }),
  });
}
