/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS,
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS,
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER,
} from './policyCandidateCorrectionSignalSnapshot.mjs';
import {
  buildPolicyCandidateCorrectionAnalyticsMetricsReport,
} from './policyCandidateCorrectionAnalyticsMetrics.mjs';
import {
  buildPolicyCandidateCorrectionCalibrationReadiness,
} from './policyCandidateCorrectionCalibrationReadiness.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_VERSION,
  buildPolicyCandidateCorrectionTemporalStability,
} from './policyCandidateCorrectionTemporalStability.mjs';

export const POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_REPORT_VERSION =
  'policy.candidate_correction_analytics_metrics.v3';

const EMPTY_CALIBRATION_READINESS = Object.freeze(
  buildPolicyCandidateCorrectionCalibrationReadiness({
    applicableDecisionCount: 0,
    changedSelectionOutcomeCount: 0,
  }),
);

function evidenceSourceStateKey(value) {
  return `${value.evidenceSourceId}:${value.evidenceStateId}`;
}

function bucketById(buckets, keyForBucket) {
  return new Map((Array.isArray(buckets) ? buckets : []).map((bucket) => [keyForBucket(bucket), bucket]));
}

function buildTemporalBucket(identity, currentBucket, previousBucket) {
  return Object.freeze({
    ...identity,
    stability: buildPolicyCandidateCorrectionTemporalStability({
      currentCalibrationReadiness: currentBucket?.calibrationReadiness || EMPTY_CALIBRATION_READINESS,
      previousCalibrationReadiness: previousBucket?.calibrationReadiness || EMPTY_CALIBRATION_READINESS,
    }),
  });
}

function buildMarginTemporalBuckets(currentReport, previousReport) {
  const currentBuckets = bucketById(currentReport.marginBuckets, (bucket) => bucket.marginBandId);
  const previousBuckets = bucketById(previousReport.marginBuckets, (bucket) => bucket.marginBandId);

  return Object.freeze(POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER.map((marginBandId) => (
    buildTemporalBucket(
      { marginBandId },
      currentBuckets.get(marginBandId),
      previousBuckets.get(marginBandId),
    )
  )));
}

function buildEvidenceSourceStateTemporalBuckets(currentReport, previousReport) {
  const currentBuckets = bucketById(currentReport.evidenceSourceStateBuckets, evidenceSourceStateKey);
  const previousBuckets = bucketById(previousReport.evidenceSourceStateBuckets, evidenceSourceStateKey);
  const keys = new Set([...currentBuckets.keys(), ...previousBuckets.keys()]);

  return Object.freeze(Array.from(keys)
    .map((key) => {
      const [evidenceSourceId, evidenceStateId] = key.split(':');
      return buildTemporalBucket(
        { evidenceSourceId, evidenceStateId },
        currentBuckets.get(key),
        previousBuckets.get(key),
      );
    })
    .sort((left, right) => (
      POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.indexOf(left.evidenceSourceId) -
        POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.indexOf(right.evidenceSourceId) ||
      POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS.indexOf(left.evidenceStateId) -
        POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS.indexOf(right.evidenceStateId)
    )));
}

/**
 * Builds adjacent-window aggregate monitoring. Both period reports use the
 * existing fixed dimensions; no event, identity, configuration, or route data
 * is added to the response.
 */
export function buildPolicyCandidateCorrectionTemporalStabilityReport({
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

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_REPORT_VERSION,
    window: currentReport.window,
    previousWindow: previousReport.window,
    marginBuckets: currentReport.marginBuckets,
    previousMarginBuckets: previousReport.marginBuckets,
    evidenceSourceStateBuckets: currentReport.evidenceSourceStateBuckets,
    previousEvidenceSourceStateBuckets: previousReport.evidenceSourceStateBuckets,
    summary: currentReport.summary,
    previousSummary: previousReport.summary,
    calibrationReadiness: currentReport.calibrationReadiness,
    previousCalibrationReadiness: previousReport.calibrationReadiness,
    readiness: currentReport.readiness,
    temporalStability: Object.freeze({
      version: POLICY_CANDIDATE_CORRECTION_TEMPORAL_STABILITY_VERSION,
      summary: buildPolicyCandidateCorrectionTemporalStability({
        currentCalibrationReadiness: currentReport.calibrationReadiness,
        previousCalibrationReadiness: previousReport.calibrationReadiness,
      }),
      marginBuckets: buildMarginTemporalBuckets(currentReport, previousReport),
      evidenceSourceStateBuckets: buildEvidenceSourceStateTemporalBuckets(currentReport, previousReport),
    }),
  });
}
