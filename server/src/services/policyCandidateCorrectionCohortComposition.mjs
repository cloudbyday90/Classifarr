/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_VERSION =
  'policy.candidate_correction_cohort_composition.v1';

export const POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS = Object.freeze({
  INSUFFICIENT_DATA: 'insufficient_data',
  COMPOSITION_COMPARABLE: 'composition_comparable',
  MATERIAL_SHIFT_DETECTED: 'material_shift_detected',
});

export const POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_MINIMUM_OBSERVATION_COUNT = 20;
export const POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_MATERIAL_SHIFT_THRESHOLD_PERCENT = 20;

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function rawRatePercent(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator * 100;
}

function ratePercent(numerator, denominator) {
  return Math.round(rawRatePercent(numerator, denominator) * 10) / 10;
}

function normalizedBucketIds(value) {
  const ids = Array.isArray(value) ? value : [];
  if (!ids.length || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    throw new TypeError('A non-empty set of unique fixed composition bucket identifiers is required.');
  }
  return ids;
}

function countForBucket(value, bucketId) {
  return nonnegativeCount(value?.[bucketId]);
}

/**
 * Compares the distribution of one fixed, aggregate-only dimension across two
 * adjacent periods. Total-variation distance is a descriptive screen: it
 * identifies material cohort-mix change and is not a significance test,
 * correctness claim, or authorization to adjust policy or routing.
 */
export function buildPolicyCandidateCorrectionCohortCompositionComparison({
  bucketIds,
  currentCountsByBucketId = {},
  previousCountsByBucketId = {},
} = {}) {
  const fixedBucketIds = normalizedBucketIds(bucketIds);
  const currentObservationCount = fixedBucketIds.reduce(
    (total, bucketId) => total + countForBucket(currentCountsByBucketId, bucketId),
    0,
  );
  const previousObservationCount = fixedBucketIds.reduce(
    (total, bucketId) => total + countForBucket(previousCountsByBucketId, bucketId),
    0,
  );
  const buckets = fixedBucketIds.map((bucketId) => {
    const currentObservationCountForBucket = countForBucket(currentCountsByBucketId, bucketId);
    const previousObservationCountForBucket = countForBucket(previousCountsByBucketId, bucketId);
    const rawCurrentSharePercent = rawRatePercent(
      currentObservationCountForBucket,
      currentObservationCount,
    );
    const rawPreviousSharePercent = rawRatePercent(
      previousObservationCountForBucket,
      previousObservationCount,
    );
    const currentSharePercent = ratePercent(
      currentObservationCountForBucket,
      currentObservationCount,
    );
    const previousSharePercent = ratePercent(
      previousObservationCountForBucket,
      previousObservationCount,
    );

    return Object.freeze({
      bucketId,
      currentObservationCount: currentObservationCountForBucket,
      previousObservationCount: previousObservationCountForBucket,
      currentSharePercent,
      previousSharePercent,
      sharePointChangePercent: Math.round((rawCurrentSharePercent - rawPreviousSharePercent) * 10) / 10,
      rawSharePointChangePercent: rawCurrentSharePercent - rawPreviousSharePercent,
    });
  });
  const hasSufficientData =
    currentObservationCount >= POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_MINIMUM_OBSERVATION_COUNT &&
    previousObservationCount >= POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_MINIMUM_OBSERVATION_COUNT;
  const totalVariationDistancePercent = hasSufficientData
    ? Math.round(buckets.reduce(
      (total, bucket) => total + Math.abs(bucket.rawSharePointChangePercent),
      0,
    ) / 2 * 10) / 10
    : null;
  const statusId = !hasSufficientData
    ? POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.INSUFFICIENT_DATA
    : (totalVariationDistancePercent >=
      POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_MATERIAL_SHIFT_THRESHOLD_PERCENT
      ? POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.MATERIAL_SHIFT_DETECTED
      : POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_STATUS_IDS.COMPOSITION_COMPARABLE);

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_VERSION,
    statusId,
    currentObservationCount,
    previousObservationCount,
    minimumObservationCount:
      POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_MINIMUM_OBSERVATION_COUNT,
    materialShiftThresholdPercent:
      POLICY_CANDIDATE_CORRECTION_COHORT_COMPOSITION_MATERIAL_SHIFT_THRESHOLD_PERCENT,
    totalVariationDistancePercent,
    buckets: Object.freeze(buckets.map((bucket) => Object.freeze({
      bucketId: bucket.bucketId,
      currentObservationCount: bucket.currentObservationCount,
      previousObservationCount: bucket.previousObservationCount,
      currentSharePercent: bucket.currentSharePercent,
      previousSharePercent: bucket.previousSharePercent,
      sharePointChangePercent: bucket.sharePointChangePercent,
    }))),
  });
}
