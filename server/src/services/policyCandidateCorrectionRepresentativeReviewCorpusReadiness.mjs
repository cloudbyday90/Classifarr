/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS,
} from './policyCandidateCorrectionLongHorizonTrend.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_VERSION =
  'policy.candidate_correction_representative_review_corpus.v1';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_STATUS_IDS = Object.freeze({
  REVIEW_NOT_INDICATED: 'review_not_indicated',
  HISTORICAL_CORPUS_DESIGN_REQUIRED: 'historical_corpus_design_required',
});

const HISTORICAL_REVIEW_FRAME = Object.freeze({
  periodCount: 2,
  completedUtcDaysPerPeriod: 28,
  strata: Object.freeze([
    'score_margin_band',
    'operator_selection_outcome',
  ]),
});
const REQUIRED_SAFEGUARD_IDS = Object.freeze([
  'authorization',
  'redaction',
  'retention',
  'operator_audit',
]);
const TREND_STATUS_IDS = new Set(
  Object.values(POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS),
);

/**
 * Declares the future historical-review boundary without selecting, retaining,
 * or returning a historical record. A sustained aggregate signal may justify
 * designing a corpus, but it never authorizes record-level access by itself.
 */
export function buildPolicyCandidateCorrectionRepresentativeReviewCorpusReadiness({
  trendStatusId,
} = {}) {
  if (!TREND_STATUS_IDS.has(trendStatusId)) {
    throw new TypeError('A valid long-horizon trend status is required.');
  }

  const historicalReviewIsIndicated = trendStatusId ===
    POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_STATUS_IDS.SUSTAINED_REVIEW_SIGNAL;

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_VERSION,
    statusId: historicalReviewIsIndicated
      ? POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_STATUS_IDS.HISTORICAL_CORPUS_DESIGN_REQUIRED
      : POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_STATUS_IDS.REVIEW_NOT_INDICATED,
    historicalRecordAccess: false,
    reviewFrame: historicalReviewIsIndicated ? HISTORICAL_REVIEW_FRAME : null,
    requiredSafeguardIds: historicalReviewIsIndicated ? REQUIRED_SAFEGUARD_IDS : Object.freeze([]),
  });
}
