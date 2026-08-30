/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const COHORT_COMPOSITION_VERSION = 'policy.candidate_correction_cohort_composition.v1'
const MINIMUM_OBSERVATION_COUNT = 20
const MATERIAL_SHIFT_THRESHOLD_PERCENT = 20

const STATUS_PRESENTATIONS = Object.freeze({
  insufficient_data: Object.freeze({
    label: 'Needs more cohort observations',
    message: 'At least one completed window has not reached the fixed cohort floor. Do not infer that the two cohorts are comparable yet.',
    className: 'text-gray-300',
  }),
  composition_comparable: Object.freeze({
    label: 'Cohort mix is comparable',
    message: 'The fixed aggregate mix remained within the advisory screen. This does not establish policy correctness or authorize routing changes.',
    className: 'text-blue-200',
  }),
  material_shift_detected: Object.freeze({
    label: 'Material cohort-mix shift',
    message: 'The current and previous windows contain materially different fixed aggregate mixes. Interpret any correction signal cautiously; this does not establish a policy change.',
    className: 'text-amber-200',
  }),
})

const MARGIN_BAND_IDS = Object.freeze([
  '0_to_4',
  '5_to_14',
  '15_to_29',
  '30_or_more',
])
const EVIDENCE_SOURCE_IDS = Object.freeze([
  'item_identity',
  'declared_policy',
  'observed_library_profile',
  'similar_item_retrieval',
  'confirmed_outcomes',
])
const EVIDENCE_STATE_IDS = Object.freeze([
  'anchored',
  'supporting',
  'contextual',
  'conflicting',
  'unavailable',
])

function strictNonnegativeCount(value) {
  const numericValue = Number(value)
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : null
}

function countByKey(buckets, keyForBucket) {
  return new Map((Array.isArray(buckets) ? buckets : []).map((bucket) => [
    keyForBucket(bucket),
    bucket?.outcomeCount || 0,
  ]))
}

function roundedPercent(value) {
  return Math.round(value * 10) / 10
}

function sharePercent(count, total) {
  return total ? count / total * 100 : 0
}

function expectedStatusId({ currentObservationCount, previousObservationCount, totalVariationDistancePercent }) {
  if (currentObservationCount < MINIMUM_OBSERVATION_COUNT ||
      previousObservationCount < MINIMUM_OBSERVATION_COUNT) {
    return 'insufficient_data'
  }
  return totalVariationDistancePercent >= MATERIAL_SHIFT_THRESHOLD_PERCENT
    ? 'material_shift_detected'
    : 'composition_comparable'
}

function normalizeComparison(value, { bucketIds, currentCounts, previousCounts } = {}) {
  if (value?.version !== COHORT_COMPOSITION_VERSION ||
      value?.minimumObservationCount !== MINIMUM_OBSERVATION_COUNT ||
      value?.materialShiftThresholdPercent !== MATERIAL_SHIFT_THRESHOLD_PERCENT ||
      !Array.isArray(bucketIds) || !bucketIds.length) {
    return null
  }

  const bucketsById = new Map()
  for (const entry of Array.isArray(value?.buckets) ? value.buckets : []) {
    const bucketId = typeof entry?.bucketId === 'string' ? entry.bucketId : null
    if (!bucketIds.includes(bucketId) || bucketsById.has(bucketId)) return null
    bucketsById.set(bucketId, entry)
  }
  if (bucketsById.size !== bucketIds.length) return null

  const expectedCurrentCounts = bucketIds.map((bucketId) => strictNonnegativeCount(currentCounts?.get(bucketId) || 0))
  const expectedPreviousCounts = bucketIds.map((bucketId) => strictNonnegativeCount(previousCounts?.get(bucketId) || 0))
  if (expectedCurrentCounts.includes(null) || expectedPreviousCounts.includes(null)) return null

  const currentObservationCount = expectedCurrentCounts.reduce((total, count) => total + count, 0)
  const previousObservationCount = expectedPreviousCounts.reduce((total, count) => total + count, 0)
  const hasSufficientData = currentObservationCount >= MINIMUM_OBSERVATION_COUNT &&
    previousObservationCount >= MINIMUM_OBSERVATION_COUNT
  const normalizedBuckets = bucketIds.map((bucketId, index) => {
    const currentObservationCountForBucket = expectedCurrentCounts[index]
    const previousObservationCountForBucket = expectedPreviousCounts[index]
    const rawCurrentSharePercent = sharePercent(currentObservationCountForBucket, currentObservationCount)
    const rawPreviousSharePercent = sharePercent(previousObservationCountForBucket, previousObservationCount)
    const currentSharePercent = roundedPercent(rawCurrentSharePercent)
    const previousSharePercent = roundedPercent(rawPreviousSharePercent)
    const sharePointChangePercent = roundedPercent(rawCurrentSharePercent - rawPreviousSharePercent)
    const entry = bucketsById.get(bucketId)

    if (strictNonnegativeCount(entry?.currentObservationCount) !== currentObservationCountForBucket ||
        strictNonnegativeCount(entry?.previousObservationCount) !== previousObservationCountForBucket ||
        entry?.currentSharePercent !== currentSharePercent ||
        entry?.previousSharePercent !== previousSharePercent ||
        entry?.sharePointChangePercent !== sharePointChangePercent) {
      return null
    }

    return Object.freeze({
      bucketId,
      currentObservationCount: currentObservationCountForBucket,
      previousObservationCount: previousObservationCountForBucket,
      currentSharePercent,
      previousSharePercent,
      sharePointChangePercent,
    })
  })
  if (normalizedBuckets.includes(null)) return null

  const totalVariationDistancePercent = hasSufficientData
    ? roundedPercent(bucketIds.reduce((total, _bucketId, index) => (
      total + Math.abs(
        sharePercent(expectedCurrentCounts[index], currentObservationCount) -
        sharePercent(expectedPreviousCounts[index], previousObservationCount),
      )
    ), 0) / 2)
    : null
  const statusId = expectedStatusId({
    currentObservationCount,
    previousObservationCount,
    totalVariationDistancePercent,
  })
  if (!STATUS_PRESENTATIONS[value?.statusId] ||
      value?.currentObservationCount !== currentObservationCount ||
      value?.previousObservationCount !== previousObservationCount ||
      value?.totalVariationDistancePercent !== totalVariationDistancePercent ||
      value?.statusId !== statusId) {
    return null
  }

  return Object.freeze({
    statusId,
    currentObservationCount,
    previousObservationCount,
    minimumObservationCount: MINIMUM_OBSERVATION_COUNT,
    materialShiftThresholdPercent: MATERIAL_SHIFT_THRESHOLD_PERCENT,
    totalVariationDistancePercent,
    buckets: Object.freeze(normalizedBuckets),
  })
}

function evidenceSourceCounts(buckets) {
  return countByKey(
    buckets,
    (bucket) => `${bucket?.evidenceSourceId}:${bucket?.evidenceStateId}`,
  )
}

function sourceHasObservations(counts, evidenceSourceId) {
  return EVIDENCE_STATE_IDS.some((evidenceStateId) => (
    strictNonnegativeCount(counts.get(`${evidenceSourceId}:${evidenceStateId}`) || 0) > 0
  ))
}

function expectedSummaryStatusId(counts) {
  if (counts.materialShiftDimensionCount > 0) return 'material_shift_detected'
  if (counts.insufficientDataDimensionCount > 0) return 'insufficient_data'
  return 'composition_comparable'
}

/**
 * Revalidates the aggregate-only cohort comparison against the two period
 * reports already accepted for rendering. Unknown dimensions and server prose
 * are discarded; this diagnostic never changes routing or policy.
 */
export function normalizePolicyCandidateCorrectionCohortComposition(
  value,
  {
    currentMarginBuckets,
    previousMarginBuckets,
    currentEvidenceSourceStateBuckets,
    previousEvidenceSourceStateBuckets,
  } = {},
) {
  if (value?.version !== COHORT_COMPOSITION_VERSION) return null

  const marginBands = normalizeComparison(value.marginBands, {
    bucketIds: MARGIN_BAND_IDS,
    currentCounts: countByKey(currentMarginBuckets, (bucket) => bucket?.marginBandId),
    previousCounts: countByKey(previousMarginBuckets, (bucket) => bucket?.marginBandId),
  })
  if (!marginBands) return null

  const currentEvidenceCounts = evidenceSourceCounts(currentEvidenceSourceStateBuckets)
  const previousEvidenceCounts = evidenceSourceCounts(previousEvidenceSourceStateBuckets)
  const expectedEvidenceSourceIds = EVIDENCE_SOURCE_IDS.filter((evidenceSourceId) => (
    sourceHasObservations(currentEvidenceCounts, evidenceSourceId) ||
    sourceHasObservations(previousEvidenceCounts, evidenceSourceId)
  ))
  const evidenceSourcesById = new Map()
  for (const entry of Array.isArray(value.evidenceSources) ? value.evidenceSources : []) {
    const evidenceSourceId = typeof entry?.evidenceSourceId === 'string'
      ? entry.evidenceSourceId
      : null
    if (!expectedEvidenceSourceIds.includes(evidenceSourceId) || evidenceSourcesById.has(evidenceSourceId)) {
      return null
    }
    const comparison = normalizeComparison(entry.comparison, {
      bucketIds: EVIDENCE_STATE_IDS.map((evidenceStateId) => `${evidenceSourceId}:${evidenceStateId}`),
      currentCounts: currentEvidenceCounts,
      previousCounts: previousEvidenceCounts,
    })
    if (!comparison) return null
    evidenceSourcesById.set(evidenceSourceId, Object.freeze({ evidenceSourceId, comparison }))
  }
  if (evidenceSourcesById.size !== expectedEvidenceSourceIds.length) return null

  const evidenceSources = Object.freeze(expectedEvidenceSourceIds.map(
    (evidenceSourceId) => evidenceSourcesById.get(evidenceSourceId),
  ))
  const dimensions = [marginBands, ...evidenceSources.map(({ comparison }) => comparison)]
  const counts = dimensions.reduce((total, comparison) => {
    if (comparison.statusId === 'material_shift_detected') total.materialShiftDimensionCount += 1
    else if (comparison.statusId === 'composition_comparable') total.comparableDimensionCount += 1
    else total.insufficientDataDimensionCount += 1
    return total
  }, {
    materialShiftDimensionCount: 0,
    comparableDimensionCount: 0,
    insufficientDataDimensionCount: 0,
  })
  const statusId = expectedSummaryStatusId(counts)
  if (!STATUS_PRESENTATIONS[value?.statusId] ||
      value.materialShiftDimensionCount !== counts.materialShiftDimensionCount ||
      value.comparableDimensionCount !== counts.comparableDimensionCount ||
      value.insufficientDataDimensionCount !== counts.insufficientDataDimensionCount ||
      value.statusId !== statusId) {
    return null
  }

  return Object.freeze({
    statusId,
    ...counts,
    marginBands,
    evidenceSources,
  })
}

export function getPolicyCandidateCorrectionCohortCompositionPresentation(statusId) {
  return STATUS_PRESENTATIONS[statusId] || null
}
