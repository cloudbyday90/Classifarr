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
  POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS,
  POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_VERSION,
  buildPolicyCandidateCorrectionCohortCompositionComparison,
} from './policyCandidateCorrectionCohortComposition.mjs';

function evidenceSourceStateKey(value) {
  return `${value.evidenceSourceId}:${value.evidenceStateId}`;
}

function outcomeCountsByBucketId(buckets, bucketIdForBucket) {
  return Object.fromEntries((Array.isArray(buckets) ? buckets : []).map((bucket) => [
    bucketIdForBucket(bucket),
    bucket.outcomeCount,
  ]));
}

function comparisonStatusCounts(comparisons) {
  return (Array.isArray(comparisons) ? comparisons : []).reduce((counts, comparison) => {
    if (comparison?.statusId === POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.MATERIAL_SHIFT_DETECTED) {
      counts.materialShiftDimensionCount += 1;
    } else if (comparison?.statusId === POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.COMPOSITION_COMPARABLE) {
      counts.comparableDimensionCount += 1;
    } else {
      counts.insufficientDataDimensionCount += 1;
    }
    return counts;
  }, {
    materialShiftDimensionCount: 0,
    comparableDimensionCount: 0,
    insufficientDataDimensionCount: 0,
  });
}

function summaryStatusId(counts) {
  if (counts.materialShiftDimensionCount > 0) {
    return POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.MATERIAL_SHIFT_DETECTED;
  }
  if (counts.insufficientDataDimensionCount > 0) {
    return POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.INSUFFICIENT_DATA;
  }
  return POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.COMPOSITION_COMPARABLE;
}

function buildEvidenceSourceComparisons(currentReport, previousReport) {
  const currentBuckets = outcomeCountsByBucketId(
    currentReport.evidenceSourceStateBuckets,
    evidenceSourceStateKey,
  );
  const previousBuckets = outcomeCountsByBucketId(
    previousReport.evidenceSourceStateBuckets,
    evidenceSourceStateKey,
  );

  return Object.freeze(POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.map((evidenceSourceId) => {
    const bucketIds = POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS.map(
      (evidenceStateId) => `${evidenceSourceId}:${evidenceStateId}`,
    );
    const comparison = buildPolicyCandidateCorrectionCohortCompositionComparison({
      bucketIds,
      currentCountsByBucketId: currentBuckets,
      previousCountsByBucketId: previousBuckets,
    });
    return Object.freeze({ evidenceSourceId, comparison });
  }).filter(({ comparison }) => (
    comparison.currentObservationCount > 0 || comparison.previousObservationCount > 0
  )));
}

/**
 * Reports whether a corrected-selection signal was observed against the same
 * aggregate cohort mix in both adjacent periods. It exposes only the fixed
 * score-margin and evidence-state vocabulary already present in the reports.
 */
export function buildPolicyCandidateCorrectionCohortCompositionReport({
  currentReport,
  previousReport,
} = {}) {
  const marginBands = buildPolicyCandidateCorrectionCohortCompositionComparison({
    bucketIds: POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER,
    currentCountsByBucketId: outcomeCountsByBucketId(
      currentReport?.marginBuckets,
      (bucket) => bucket.marginBandId,
    ),
    previousCountsByBucketId: outcomeCountsByBucketId(
      previousReport?.marginBuckets,
      (bucket) => bucket.marginBandId,
    ),
  });
  const evidenceSources = buildEvidenceSourceComparisons(currentReport || {}, previousReport || {});
  const counts = comparisonStatusCounts([marginBands, ...evidenceSources.map(({ comparison }) => comparison)]);

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_VERSION,
    statusId: summaryStatusId(counts),
    ...counts,
    marginBands,
    evidenceSources,
  });
}
