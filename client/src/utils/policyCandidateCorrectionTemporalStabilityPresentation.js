/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const TEMPORAL_STABILITY_VERSION = 'policy.candidate_correction_temporal_stability.v1'

const STATUS_PRESENTATIONS = Object.freeze({
  insufficient_comparison_data: Object.freeze({
    label: 'Needs two representative windows',
    message: 'At least one adjacent completed window has not reached the fixed applicable-decision floor. Keep observing before treating a pattern as persistent.',
    className: 'text-gray-300',
  }),
  persistent_review_signal: Object.freeze({
    label: 'Persistent review signal',
    message: 'The same aggregate met the fixed review criterion in both adjacent completed windows. Review representative individual decisions before considering maintenance.',
    className: 'text-amber-200',
  }),
  emerging_review_signal: Object.freeze({
    label: 'New review signal',
    message: 'Only the current window met the fixed review criterion. Observe another completed window before treating this as a durable pattern.',
    className: 'text-blue-200',
  }),
  diminishing_review_signal: Object.freeze({
    label: 'Diminishing review signal',
    message: 'Only the previous window met the fixed review criterion. Continue observing; this does not establish that a policy change caused improvement.',
    className: 'text-blue-200',
  }),
  stable_no_material_signal: Object.freeze({
    label: 'Stable low signal',
    message: 'Both adjacent windows remained below the fixed review floor. This is not a correctness guarantee and does not change routing.',
    className: 'text-blue-200',
  }),
  inconclusive: Object.freeze({
    label: 'Inconclusive across windows',
    message: 'The adjacent-window results do not establish a persistent review pattern. Continue observing the fixed aggregate.',
    className: 'text-blue-200',
  }),
})

const CALIBRATION_STATUS_IDS = new Set([
  'insufficient_data',
  'review_recommended',
  'inconclusive',
  'no_material_signal',
])

function nonnegativeCount(value) {
  const numericValue = Number(value)
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : null
}

function expectedStatusId(currentStatusId, previousStatusId) {
  if (currentStatusId === 'insufficient_data' || previousStatusId === 'insufficient_data') {
    return 'insufficient_comparison_data'
  }
  if (currentStatusId === 'review_recommended' && previousStatusId === 'review_recommended') {
    return 'persistent_review_signal'
  }
  if (currentStatusId === 'review_recommended') return 'emerging_review_signal'
  if (previousStatusId === 'review_recommended') return 'diminishing_review_signal'
  if (currentStatusId === 'no_material_signal' && previousStatusId === 'no_material_signal') {
    return 'stable_no_material_signal'
  }
  return 'inconclusive'
}

function normalizedStability(value, currentCalibrationReadiness, previousCalibrationReadiness) {
  const currentStatusId = currentCalibrationReadiness?.statusId
  const previousStatusId = previousCalibrationReadiness?.statusId
  const currentApplicableDecisionCount = nonnegativeCount(
    currentCalibrationReadiness?.applicableDecisionCount,
  )
  const previousApplicableDecisionCount = nonnegativeCount(
    previousCalibrationReadiness?.applicableDecisionCount,
  )
  if (value?.version !== TEMPORAL_STABILITY_VERSION ||
      !CALIBRATION_STATUS_IDS.has(currentStatusId) ||
      !CALIBRATION_STATUS_IDS.has(previousStatusId) ||
      currentApplicableDecisionCount === null ||
      previousApplicableDecisionCount === null ||
      !STATUS_PRESENTATIONS[value?.statusId] ||
      value.currentStatusId !== currentStatusId ||
      value.previousStatusId !== previousStatusId ||
      value.currentApplicableDecisionCount !== currentApplicableDecisionCount ||
      value.previousApplicableDecisionCount !== previousApplicableDecisionCount ||
      value.statusId !== expectedStatusId(currentStatusId, previousStatusId)) {
    return null
  }

  return Object.freeze({
    statusId: value.statusId,
    currentStatusId,
    previousStatusId,
    currentApplicableDecisionCount,
    previousApplicableDecisionCount,
  })
}

function bucketMap(buckets, keyForBucket) {
  return new Map((Array.isArray(buckets) ? buckets : []).map((bucket) => [keyForBucket(bucket), bucket]))
}

function normalizedBuckets(value, currentBuckets, previousBuckets, keyForBucket) {
  const currentBucketsByKey = bucketMap(currentBuckets, keyForBucket)
  const previousBucketsByKey = bucketMap(previousBuckets, keyForBucket)
  const expectedKeys = new Set([
    ...currentBucketsByKey.keys(),
    ...previousBucketsByKey.keys(),
  ])
  const normalizedByKey = new Map()

  for (const entry of Array.isArray(value) ? value : []) {
    const key = keyForBucket(entry)
    if (!expectedKeys.has(key) || normalizedByKey.has(key)) return null
    const currentBucket = currentBucketsByKey.get(key)
    const previousBucket = previousBucketsByKey.get(key)
    const stability = normalizedStability(
      entry?.stability,
      currentBucket?.calibrationReadiness || {
        statusId: 'insufficient_data',
        applicableDecisionCount: 0,
      },
      previousBucket?.calibrationReadiness || {
        statusId: 'insufficient_data',
        applicableDecisionCount: 0,
      },
    )
    if (!stability) return null
    normalizedByKey.set(key, Object.freeze({ key, stability }))
  }

  if (normalizedByKey.size !== expectedKeys.size) return null
  return Object.freeze(Array.from(expectedKeys, (key) => normalizedByKey.get(key)))
}

/**
 * Revalidates the server's derived adjacent-window status against the two
 * already validated, aggregate-only period reports. Server copy and unknown
 * dimensions are not accepted for rendering.
 */
export function normalizePolicyCandidateCorrectionTemporalStability(
  value,
  {
    currentSummary,
    previousSummary,
    currentMarginBuckets,
    previousMarginBuckets,
    currentEvidenceSourceStateBuckets,
    previousEvidenceSourceStateBuckets,
  } = {},
) {
  if (value?.version !== TEMPORAL_STABILITY_VERSION) return null

  const summary = normalizedStability(
    value.summary,
    currentSummary?.calibrationReadiness,
    previousSummary?.calibrationReadiness,
  )
  const marginBuckets = normalizedBuckets(
    value.marginBuckets,
    currentMarginBuckets,
    previousMarginBuckets,
    (bucket) => bucket?.marginBandId,
  )
  const evidenceSourceStateBuckets = normalizedBuckets(
    value.evidenceSourceStateBuckets,
    currentEvidenceSourceStateBuckets,
    previousEvidenceSourceStateBuckets,
    (bucket) => `${bucket?.evidenceSourceId}:${bucket?.evidenceStateId}`,
  )
  if (!summary || !marginBuckets || !evidenceSourceStateBuckets) return null

  return Object.freeze({
    summary,
    marginBuckets,
    evidenceSourceStateBuckets,
  })
}

export function getPolicyCandidateCorrectionTemporalStabilityPresentation(statusId) {
  return STATUS_PRESENTATIONS[statusId] || null
}
