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
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
} from './policyCandidateCorrectionRepresentativeReviewCorpusVocabulary.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_VERSION =
  'policy.candidate_correction_representative_review_corpus_capture_evaluation.v1';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_STATUS_IDS = Object.freeze({
  COLLECTING: 'collecting',
  READY_FOR_HUMAN_EVALUATION: 'ready_for_human_evaluation',
});

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_MINIMUM_CAPTURE_COUNT_PER_MARGIN_BAND = 6;

const SELECTION_STATUS_IDS = Object.freeze(Object.values(
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
));
const CHANGED_SELECTION_STATUS_IDS = new Set([
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_TO_CANDIDATE,
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_OUTSIDE_CANDIDATES,
]);

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeCount(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function createOutcomeCountMap() {
  return new Map(SELECTION_STATUS_IDS.map(selectionStatusId => [selectionStatusId, 0]));
}

function buildAuthority() {
  return Object.freeze({
    scope: 'offline_evaluation_only',
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

function buildEmptyCountsByMarginBand() {
  return new Map(POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.map(scoreMarginBandId => [
    scoreMarginBandId,
    createOutcomeCountMap(),
  ]));
}

/**
 * Accepts the narrow aggregate SQL shape only. Any raw row identity, actor,
 * timestamp, media, library, policy, provider, or retrieval content belongs
 * outside this contract and must never be introduced by a caller.
 */
function normalizeAggregateRows(rows) {
  if (!Array.isArray(rows)) return null;

  const countsByMarginBand = buildEmptyCountsByMarginBand();
  const seenPairs = new Set();
  for (const value of rows) {
    const row = asPlainObject(value);
    const scoreMarginBandId = row?.score_margin_band_id;
    const selectionStatusId = row?.selection_status_id;
    const captureCount = normalizeCount(row?.capture_count);
    const pairKey = `${scoreMarginBandId}:${selectionStatusId}`;

    if (!row || !POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.includes(scoreMarginBandId) ||
        !SELECTION_STATUS_IDS.includes(selectionStatusId) || captureCount === null ||
        seenPairs.has(pairKey)) {
      return null;
    }
    seenPairs.add(pairKey);
    countsByMarginBand.get(scoreMarginBandId).set(selectionStatusId, captureCount);
  }
  return countsByMarginBand;
}

function buildMarginSummary({ scoreMarginBandId, outcomeCounts }) {
  const selectionOutcomeCounts = Object.freeze(SELECTION_STATUS_IDS.map(selectionStatusId => Object.freeze({
    selectionStatusId,
    captureCount: outcomeCounts.get(selectionStatusId),
  })));
  const capturedOutcomeCount = selectionOutcomeCounts.reduce(
    (total, entry) => total + entry.captureCount,
    0,
  );
  const confirmedCandidateCount = outcomeCounts.get(
    POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CONFIRMED_CANDIDATE,
  );
  const changedSelectionCount = selectionOutcomeCounts
    .filter(entry => CHANGED_SELECTION_STATUS_IDS.has(entry.selectionStatusId))
    .reduce((total, entry) => total + entry.captureCount, 0);

  return Object.freeze({
    scoreMarginBandId,
    capturedOutcomeCount,
    minimumCapturedOutcomeCount:
      POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_MINIMUM_CAPTURE_COUNT_PER_MARGIN_BAND,
    minimumSatisfied: capturedOutcomeCount >=
      POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_MINIMUM_CAPTURE_COUNT_PER_MARGIN_BAND,
    confirmedCandidateCount,
    changedSelectionCount,
    confirmedCandidateRate: capturedOutcomeCount > 0
      ? confirmedCandidateCount / capturedOutcomeCount
      : null,
    selectionOutcomeCounts,
  });
}

function buildReport(countsByMarginBand) {
  const marginSummaries = Object.freeze(POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.map(
    scoreMarginBandId => buildMarginSummary({
      scoreMarginBandId,
      outcomeCounts: countsByMarginBand.get(scoreMarginBandId),
    }),
  ));
  const capturedOutcomeCount = marginSummaries.reduce(
    (total, summary) => total + summary.capturedOutcomeCount,
    0,
  );
  const minimumCapturedOutcomeCount =
    POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_MINIMUM_CAPTURE_COUNT_PER_MARGIN_BAND *
    POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.length;

  return Object.freeze({
    capturedOutcomeCount,
    minimumCapturedOutcomeCount,
    scoreMarginCoverage: marginSummaries,
  });
}

/**
 * Builds a current-configuration, aggregate-only readiness report from
 * automatic future captures. This describes whether the redacted corpus is
 * broad enough for a separate human-approved evaluation plan; it does not
 * evaluate a model, alter a policy, or admit an automatic route.
 */
export function buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel({
  configuration,
  aggregateRows = [],
} = {}) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    throw new TypeError('Automatic capture configuration is required.');
  }
  const countsByMarginBand = normalizeAggregateRows(aggregateRows);
  if (!countsByMarginBand) {
    throw new TypeError('Capture evaluation aggregate rows are invalid.');
  }

  const report = buildReport(countsByMarginBand);
  const statusId = report.scoreMarginCoverage.every(summary => summary.minimumSatisfied)
      ? POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_STATUS_IDS.READY_FOR_HUMAN_EVALUATION
      : POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_STATUS_IDS.COLLECTING;

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_EVALUATION_VERSION,
    statusId,
    purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
    automaticFutureCapture: true,
    authority: buildAuthority(),
    report,
  });
}
