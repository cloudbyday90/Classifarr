/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyCandidateCorrectionAnalyticsMetricsReport,
} from './policyCandidateCorrectionAnalyticsMetrics.mjs';
import {
  buildPolicyCandidateCorrectionCohortCompositionReport,
} from './policyCandidateCorrectionCohortCompositionReport.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_VERSION,
  buildPolicyCandidateCorrectionLongHorizonTrend,
} from './policyCandidateCorrectionLongHorizonTrend.mjs';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusReadiness,
} from './policyCandidateCorrectionRepresentativeReviewCorpusReadiness.mjs';

function publicPeriod(report) {
  return Object.freeze({
    window: report.window,
    marginBuckets: report.marginBuckets,
    evidenceSourceStateBuckets: report.evidenceSourceStateBuckets,
    summary: report.summary,
    calibrationReadiness: report.calibrationReadiness,
  });
}

function publicCohortComposition(report) {
  return Object.freeze({
    version: report.version,
    statusId: report.statusId,
    materialShiftDimensionCount: report.materialShiftDimensionCount,
    comparableDimensionCount: report.comparableDimensionCount,
    insufficientDataDimensionCount: report.insufficientDataDimensionCount,
  });
}

/**
 * Builds the longer-horizon report from two fixed complete periods. It carries
 * only the existing fixed aggregate dimensions needed for client verification;
 * it neither adds a query shape nor exposes an event-level history.
 */
export function buildPolicyCandidateCorrectionLongHorizonTrendReport({
  currentRows = [],
  previousRows = [],
  currentWindow = null,
  previousWindow = null,
} = {}) {
  const currentReport = buildPolicyCandidateCorrectionAnalyticsMetricsReport({
    rows: currentRows,
    window: currentWindow,
  });
  const previousReport = buildPolicyCandidateCorrectionAnalyticsMetricsReport({
    rows: previousRows,
    window: previousWindow,
  });
  const derivedCohortComposition = buildPolicyCandidateCorrectionCohortCompositionReport({
    currentReport,
    previousReport,
  });
  const trend = buildPolicyCandidateCorrectionLongHorizonTrend({
    currentCalibrationReadiness: currentReport.calibrationReadiness,
    previousCalibrationReadiness: previousReport.calibrationReadiness,
    cohortComposition: derivedCohortComposition,
  });

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_TREND_VERSION,
    current: publicPeriod(currentReport),
    previous: publicPeriod(previousReport),
    cohortComposition: publicCohortComposition(derivedCohortComposition),
    trend,
    representativeReviewCorpus: buildPolicyCandidateCorrectionRepresentativeReviewCorpusReadiness({
      trendStatusId: trend.statusId,
    }),
  });
}
