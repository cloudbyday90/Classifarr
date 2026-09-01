/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const VERSION = 'policy.candidate_correction_representative_review_corpus_capture_evaluation.v1'
const PURPOSE_ID = 'representative_historical_correction_review'
const STATUS_IDS = Object.freeze({
  COLLECTING: 'collecting',
  READY_FOR_HUMAN_EVALUATION: 'ready_for_human_evaluation',
})
const MARGIN_BAND_IDS = Object.freeze(['0_to_4', '5_to_14', '15_to_29', '30_or_more'])
const SELECTION_STATUS_IDS = Object.freeze([
  'confirmed_candidate',
  'changed_to_candidate',
  'changed_outside_candidates',
  'routed_not_applicable',
])
const MINIMUM_PER_MARGIN_BAND = 6

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function normalizeCount(value) {
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null
}

function hasExpectedAuthority(value) {
  const source = asPlainObject(value)
  const automaticActions = asPlainObject(source?.automaticActions)
  const expectedAutomaticActionIds = [
    'aiInvocation', 'learning', 'policyChange', 'ragTuning', 'retry', 'routing',
  ]
  return source?.scope === 'offline_evaluation_only' &&
    source.historicalRecordAccess === false && source.retainedItemAccess === false &&
    automaticActions && Object.keys(automaticActions).length === expectedAutomaticActionIds.length &&
    expectedAutomaticActionIds.every(key => automaticActions[key] === false)
}

function normalizeOutcomeCounts(value, capturedOutcomeCount) {
  if (!Array.isArray(value) || value.length !== SELECTION_STATUS_IDS.length) return null
  const countsByStatus = new Map()
  for (const entry of value) {
    const source = asPlainObject(entry)
    const captureCount = normalizeCount(source?.captureCount)
    if (!source || !SELECTION_STATUS_IDS.includes(source.selectionStatusId) || captureCount === null ||
        countsByStatus.has(source.selectionStatusId)) return null
    countsByStatus.set(source.selectionStatusId, captureCount)
  }
  if (countsByStatus.size !== SELECTION_STATUS_IDS.length ||
      [...countsByStatus.values()].reduce((total, count) => total + count, 0) !== capturedOutcomeCount) return null
  return Object.freeze(SELECTION_STATUS_IDS.map(selectionStatusId => Object.freeze({
    selectionStatusId,
    captureCount: countsByStatus.get(selectionStatusId),
  })))
}

function normalizeMarginCoverage(value) {
  if (!Array.isArray(value) || value.length !== MARGIN_BAND_IDS.length) return null
  const coverage = value.map((entry, index) => {
    const source = asPlainObject(entry)
    const capturedOutcomeCount = normalizeCount(source?.capturedOutcomeCount)
    const confirmedCandidateCount = normalizeCount(source?.confirmedCandidateCount)
    const changedSelectionCount = normalizeCount(source?.changedSelectionCount)
    if (!source || source.scoreMarginBandId !== MARGIN_BAND_IDS[index] ||
        capturedOutcomeCount === null || confirmedCandidateCount === null ||
        changedSelectionCount === null || confirmedCandidateCount > capturedOutcomeCount ||
        source.minimumCapturedOutcomeCount !== MINIMUM_PER_MARGIN_BAND ||
        source.minimumSatisfied !== (capturedOutcomeCount >= MINIMUM_PER_MARGIN_BAND)) return null

    const selectionOutcomeCounts = normalizeOutcomeCounts(source.selectionOutcomeCounts, capturedOutcomeCount)
    if (!selectionOutcomeCounts) return null
    const expectedRate = capturedOutcomeCount > 0 ? confirmedCandidateCount / capturedOutcomeCount : null
    if (source.confirmedCandidateRate !== expectedRate) return null
    return Object.freeze({
      scoreMarginBandId: source.scoreMarginBandId,
      capturedOutcomeCount,
      minimumSatisfied: source.minimumSatisfied,
    })
  })
  return coverage.some(entry => entry === null) ? null : Object.freeze(coverage)
}

function normalizeReport(value) {
  const source = asPlainObject(value)
  const capturedOutcomeCount = normalizeCount(source?.capturedOutcomeCount)
  const minimumCapturedOutcomeCount = normalizeCount(source?.minimumCapturedOutcomeCount)
  const scoreMarginCoverage = normalizeMarginCoverage(source?.scoreMarginCoverage)
  if (!source || capturedOutcomeCount === null || !scoreMarginCoverage ||
      minimumCapturedOutcomeCount !== MINIMUM_PER_MARGIN_BAND * MARGIN_BAND_IDS.length ||
      scoreMarginCoverage.reduce((total, entry) => total + entry.capturedOutcomeCount, 0) !== capturedOutcomeCount) return null
  return Object.freeze({ capturedOutcomeCount, minimumCapturedOutcomeCount, scoreMarginCoverage })
}

/** Drops all unknown fields before rendering the automatic aggregate status. */
export function normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluation(value) {
  const source = asPlainObject(value)
  if (!source || source.version !== VERSION || source.purposeId !== PURPOSE_ID ||
      source.automaticFutureCapture !== true || !hasExpectedAuthority(source.authority) ||
      !Object.values(STATUS_IDS).includes(source.statusId)) return null
  const report = normalizeReport(source.report)
  if (!report) return null
  const ready = report.scoreMarginCoverage.every(entry => entry.minimumSatisfied)
  if ((source.statusId === STATUS_IDS.READY_FOR_HUMAN_EVALUATION) !== ready) return null
  return Object.freeze({ statusId: source.statusId, report })
}

export function getPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationPresentation(evaluation) {
  const statusId = evaluation?.statusId
  if (statusId === STATUS_IDS.COLLECTING && evaluation?.report) {
    const { capturedOutcomeCount, minimumCapturedOutcomeCount } = evaluation.report
    return Object.freeze({
      heading: 'Collecting redacted operator outcomes automatically',
      message: `${capturedOutcomeCount} of ${minimumCapturedOutcomeCount} baseline outcomes are retained across the four score-margin bands. No action is needed; this status refreshes while this page is open.`,
      statusClass: 'text-blue-300',
    })
  }
  if (statusId === STATUS_IDS.READY_FOR_HUMAN_EVALUATION && evaluation?.report) {
    return Object.freeze({
      heading: 'Redacted evaluation baseline is ready',
      message: 'Each score-margin band has enough future operator outcomes for a separate human-reviewed evaluation plan. This does not approve a policy, AI, RAG, or routing change.',
      statusClass: 'text-green-400',
    })
  }
  return null
}
