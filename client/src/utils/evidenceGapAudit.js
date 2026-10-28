/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const auditCaptureReasons = ['invalid', 'duplicateIdentityOrDescription', 'unboundCaptures', 'identityMismatchCaptures',
  'conflicting', 'unverifiedCaptures', 'awaitingOutcome', 'unavailable', 'mixedKinds', 'outsideCandidateScope']
export const auditObservationReasons = ['missingSnapshotRows', 'unknownKindRows', 'unverifiedOutcomeRows',
  'identityMismatchRows', 'sourceOnlyRows', 'unavailableOutcomeRows', 'excludedTemporalRows']
const failures = ['busy', 'memory_pressure', 'memory_unknown', 'evidence_budget', 'invalid_evidence', 'deadline', 'evaluation_unavailable']
const deferrals = failures.slice(0, 3)
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const count = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max
const time = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const limits = { retentionDays: 30, captures: 5000, observationsPerCapture: 100, observationSentinel: 101,
  historicalRecovery: 'not_assessed', notAccuracy: true, placementsAreNotEvaluationLabels: true,
  promotionAllowed: false, providerCalls: 0, sourceWrites: 0, routingWrites: 0, learningWrites: 0, importWrites: 0 }

function validReport(value) {
  if (!exact(value, ['version', 'window', 'intake', 'comparisons', 'observations', 'evidencePhase', 'limits']) ||
    value.version !== 'evidence_gap_audit.v1' || !exact(value.window, ['since', 'until', 'outcomesAsOf']) ||
    !Object.values(value.window).every(time) || value.window.until !== value.window.outcomesAsOf ||
    Date.parse(value.window.until) - Date.parse(value.window.since) !== 30 * 86400000 ||
    !exact(value.intake, ['recordedMovieTvEvents', 'capped', 'withoutRetainedComparison']) ||
    !count(value.intake.recordedMovieTvEvents, 5001) || value.intake.capped !== (value.intake.recordedMovieTvEvents === 5001) ||
    !exact(value.comparisons, ['inspected', 'eligible', 'exclusions', 'observationOverflowCaptures'])) return false
  const { intake, comparisons: c, observations: o } = value
  if (!count(c.inspected, 5000) || !count(c.eligible, c.inspected) || !exact(c.exclusions, auditCaptureReasons) ||
    !Object.values(c.exclusions).every(n => count(n, c.inspected)) ||
    Object.values(c.exclusions).reduce((a, b) => a + b, c.eligible) !== c.inspected ||
    !count(c.observationOverflowCaptures, c.exclusions.invalid) ||
    (intake.capped ? intake.withoutRetainedComparison !== null : intake.recordedMovieTvEvents < c.inspected ||
      intake.withoutRetainedComparison !== intake.recordedMovieTvEvents - c.inspected) ||
    !exact(o, ['scope', 'overlappingReasons', 'mayBeTruncated', 'groupsAtLimit', 'reasons']) ||
    o.scope !== 'bounded_inspected_records' || o.overlappingReasons !== true || !count(o.groupsAtLimit, c.inspected) ||
    o.groupsAtLimit < c.observationOverflowCaptures || o.mayBeTruncated !== (o.groupsAtLimit > 0) ||
    !exact(o.reasons, auditObservationReasons) || !Object.values(o.reasons).every(n => count(n, c.inspected * 101)) ||
    !exact(value.limits, Object.keys(limits)) || !Object.entries(limits).every(([key, expected]) => value.limits[key] === expected)) return false
  const phase = intake.recordedMovieTvEvents === 0 ? 'awaiting_classification_intake' : c.inspected === 0 ? 'awaiting_live_comparisons'
    : c.eligible ? 'diagnostic_only' : c.exclusions.awaitingOutcome ? 'awaiting_operator_outcomes' : 'no_eligible_outcomes'
  return value.evidencePhase === phase
}

/** Exact safe contract; never retain unprojected API reports or error text. */
export function normalizeEvidenceGapAudit(value) {
  if (!exact(value, ['version', 'status', 'reason', 'checkedAt', 'observedAt', 'nextCheckAt', 'report']) ||
    value.version !== 'evidence_gap_audit_status.v1' || !time(value.checkedAt) ||
    !['complete', 'never_run', 'unavailable', 'invalid', 'stale', 'deferred', 'failed'].includes(value.status) ||
    value.observedAt !== null && (!time(value.observedAt) || value.observedAt > value.checkedAt) ||
    value.nextCheckAt !== null && (!time(value.nextCheckAt) || !value.observedAt || value.nextCheckAt <= value.observedAt ||
      Date.parse(value.nextCheckAt) > Date.parse(value.checkedAt) + 60 * 60000)) return null
  if (['failed', 'deferred'].includes(value.status)) {
    if (!failures.includes(value.reason) || (value.status === 'deferred') !== deferrals.includes(value.reason) ||
      !value.observedAt || !value.nextCheckAt || value.report !== null) return null
  } else if (value.reason !== null) return null
  if (['never_run', 'unavailable'].includes(value.status) && (value.observedAt !== null || value.nextCheckAt !== null)) return null
  if (value.status === 'stale' && (!value.observedAt || !value.nextCheckAt ||
    Date.parse(value.checkedAt) - Date.parse(value.observedAt) < 15 * 60000)) return null
  if (value.status === 'complete') {
    if (!value.observedAt || !value.nextCheckAt || Date.parse(value.checkedAt) - Date.parse(value.observedAt) >= 15 * 60000 ||
      !validReport(value.report) || value.report.window.until !== value.observedAt) return null
  } else if (value.report !== null) return null
  return value
}
