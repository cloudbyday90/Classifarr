/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_LATENCY_BANDS,
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_TELEMETRY_VERSION,
} from './currentLibraryCandidateRetrievalTelemetry.mjs';
import {
  buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness,
} from './currentLibraryCandidateRetrievalPolicyReviewReadiness.mjs';
import {
  buildPolicyConfirmationEvidenceReadiness,
} from './policyConfirmationEvidenceReadiness.mjs';
import {
  buildCurrentLibraryCandidateSemanticAdjudicationMetrics,
} from './currentLibraryCandidateSemanticAdjudicationMetrics.mjs';
import {
  COMPLETED_UTC_DAY_METRICS_DEFAULT_WINDOW_DAYS,
  COMPLETED_UTC_DAY_METRICS_MAX_WINDOW_DAYS,
  buildCompletedUtcDayMetricsWindow,
  normalizeCompletedUtcDayMetricsWindowDays,
} from './completedUtcDayMetricsWindow.mjs';

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_VERSION =
  'current_library.candidate_retrieval_metrics.v1';
export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_DEFAULT_WINDOW_DAYS =
  COMPLETED_UTC_DAY_METRICS_DEFAULT_WINDOW_DAYS;
export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_MAX_WINDOW_DAYS =
  COMPLETED_UTC_DAY_METRICS_MAX_WINDOW_DAYS;

function dateOnly(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : null;
}

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function ratePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function normalizeCurrentLibraryCandidateRetrievalMetricsWindowDays(value) {
  return normalizeCompletedUtcDayMetricsWindowDays(value);
}

/**
 * Builds complete UTC-day windows so an in-progress day cannot make a
 * monitoring comparison look like an operational regression.
 */
export function buildCurrentLibraryCandidateRetrievalMetricsWindow({
  windowDays,
  now = new Date(),
} = {}) {
  return buildCompletedUtcDayMetricsWindow({ windowDays, now });
}

function latencyBandCount(row, id) {
  const fieldByBand = {
    under_25ms: 'under25msCount',
    '25_to_99ms': 'from25To99msCount',
    '100_to_249ms': 'from100To249msCount',
    '250_to_999ms': 'from250To999msCount',
    '1000ms_or_more': 'from1000msOrMoreCount',
  };
  return nonnegativeCount(row?.[fieldByBand[id]]);
}

/**
 * Reduces a single aggregate row into a content-free, presentation-ready
 * report. Agreement means a later operator destination matched the bounded AI
 * proposal; it is explicitly not a correctness or routing-authorization rate.
 */
export function buildCurrentLibraryCandidateRetrievalMetricsReport({
  row = {},
  window = null,
} = {}) {
  const observationCount = nonnegativeCount(row.observationCount);
  const availableCount = Math.min(observationCount, nonnegativeCount(row.availableCount));
  const unavailableCount = Math.min(observationCount, nonnegativeCount(row.unavailableCount));
  const matchingObservationCount = Math.min(availableCount, nonnegativeCount(row.matchingObservationCount));
  const directMatchObservationCount = Math.min(availableCount, nonnegativeCount(row.directMatchObservationCount));
  const candidateAdjudication = buildCurrentLibraryCandidateSemanticAdjudicationMetrics({
    row,
    observationCount,
  });
  const proposalCount = candidateAdjudication.proposalCount;
  const resolvedProposalCount = Math.min(proposalCount, nonnegativeCount(row.resolvedProposalCount));
  const agreedProposalCount = Math.min(resolvedProposalCount, nonnegativeCount(row.agreedProposalCount));
  const alternativeProposalCount = Math.min(
    resolvedProposalCount - agreedProposalCount,
    nonnegativeCount(row.alternativeProposalCount),
  );
  const resolvedOperatorOutcomeCount = Math.min(
    observationCount,
    nonnegativeCount(row.resolvedOperatorOutcomeCount),
  );
  const confirmedCandidateOutcomeCount = Math.min(
    resolvedOperatorOutcomeCount,
    nonnegativeCount(row.confirmedCandidateOutcomeCount),
  );
  const changedToCandidateOutcomeCount = Math.min(
    resolvedOperatorOutcomeCount - confirmedCandidateOutcomeCount,
    nonnegativeCount(row.changedToCandidateOutcomeCount),
  );
  const changedOutsideCandidateOutcomeCount = Math.min(
    resolvedOperatorOutcomeCount - confirmedCandidateOutcomeCount - changedToCandidateOutcomeCount,
    nonnegativeCount(row.changedOutsideCandidateOutcomeCount),
  );
  const routedNotApplicableOutcomeCount = Math.min(
    resolvedOperatorOutcomeCount - confirmedCandidateOutcomeCount - changedToCandidateOutcomeCount -
      changedOutsideCandidateOutcomeCount,
    nonnegativeCount(row.routedNotApplicableOutcomeCount),
  );
  const attributedOperatorOutcomeCount =
    confirmedCandidateOutcomeCount +
    changedToCandidateOutcomeCount +
    changedOutsideCandidateOutcomeCount +
    routedNotApplicableOutcomeCount;
  const candidateSetSelectionOutcomeCount =
    confirmedCandidateOutcomeCount + changedToCandidateOutcomeCount;
  const candidateSetDecisionOutcomeCount =
    candidateSetSelectionOutcomeCount + changedOutsideCandidateOutcomeCount;

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_VERSION,
    window: Object.freeze({
      days: window?.days || 0,
      startDate: dateOnly(window?.start),
      endDate: dateOnly(window?.end),
    }),
    retrieval: Object.freeze({
      observationCount,
      availableCount,
      unavailableCount,
      availabilityRatePercent: ratePercent(availableCount, observationCount),
      matchingObservationCount,
      directMatchObservationCount,
      latencyBands: Object.freeze(CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_LATENCY_BANDS.map((band) => Object.freeze({
        id: band.id,
        label: band.label,
        count: latencyBandCount(row, band.id),
        ratePercent: ratePercent(latencyBandCount(row, band.id), observationCount),
      }))),
    }),
    operatorAgreement: Object.freeze({
      proposalCount,
      resolvedProposalCount,
      agreedProposalCount,
      alternativeProposalCount,
      pendingProposalCount: Math.max(0, proposalCount - resolvedProposalCount),
      agreementRatePercent: ratePercent(agreedProposalCount, resolvedProposalCount),
    }),
    candidateAdjudication,
    operatorCandidateSetAttribution: Object.freeze({
      resolvedOperatorOutcomeCount,
      attributedOperatorOutcomeCount,
      confirmedCandidateOutcomeCount,
      changedToCandidateOutcomeCount,
      changedOutsideCandidateOutcomeCount,
      routedNotApplicableOutcomeCount,
      unattributedResolvedOutcomeCount: Math.max(
        0,
        resolvedOperatorOutcomeCount - attributedOperatorOutcomeCount,
      ),
      candidateSetSelectionRatePercent: ratePercent(
        candidateSetSelectionOutcomeCount,
        candidateSetDecisionOutcomeCount,
      ),
    }),
    candidateSetPolicyReview: buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness({
      candidateSetSelectionOutcomeCount,
      changedOutsideCandidateOutcomeCount,
    }),
    policyConfirmationEvidence: buildPolicyConfirmationEvidenceReadiness(row),
    readiness: Object.freeze({
      statusId: observationCount > 0 ? 'observing' : 'insufficient_data',
      message: observationCount > 0
        ? 'Aggregate retrieval and proposal-resolution observations are available. Review them before considering semantic retrieval changes.'
        : 'No current-library retrieval observations have been recorded in this completed UTC-day window yet.',
    }),
    telemetryVersion: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_TELEMETRY_VERSION,
  });
}
