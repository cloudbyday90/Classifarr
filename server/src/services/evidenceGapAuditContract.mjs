/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const GAP_AUDIT_VERSION = 'evidence_gap_audit.v1';
export const GAP_AUDIT_CAPTURE_REASONS = Object.freeze(['invalid', 'duplicateIdentityOrDescription', 'unboundCaptures',
  'identityMismatchCaptures', 'conflicting', 'unverifiedCaptures', 'awaitingOutcome', 'unavailable', 'mixedKinds', 'outsideCandidateScope']);
export const GAP_AUDIT_OBSERVATION_REASONS = Object.freeze(['missingSnapshotRows', 'unknownKindRows', 'unverifiedOutcomeRows',
  'identityMismatchRows', 'sourceOnlyRows', 'unavailableOutcomeRows', 'excludedTemporalRows']);
export const GAP_AUDIT_FAILURES = Object.freeze(['busy', 'memory_pressure', 'memory_unknown', 'evidence_budget',
  'invalid_evidence', 'deadline', 'evaluation_unavailable']);
export const GAP_AUDIT_DEFERRALS = Object.freeze(['busy', 'memory_pressure', 'memory_unknown']);
export const GAP_AUDIT_MAX_INPUT_BYTES = 64 * 1024 * 1024;
export const GAP_AUDIT_MAX_REPORT_BYTES = 16384;
export const GAP_AUDIT_LIMITS = Object.freeze({ retentionDays: 30, captures: 5000, observationsPerCapture: 100,
  observationSentinel: 101, historicalRecovery: 'not_assessed', notAccuracy: true,
  placementsAreNotEvaluationLabels: true, promotionAllowed: false, providerCalls: 0,
  sourceWrites: 0, routingWrites: 0, learningWrites: 0, importWrites: 0 });
export const gapAuditExact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const gapAuditTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const count = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;

export function gapAuditPhase(intake, comparisons) {
  return intake.recordedMovieTvEvents === 0 ? 'awaiting_classification_intake' : comparisons.inspected === 0
    ? 'awaiting_live_comparisons' : comparisons.eligible > 0 ? 'diagnostic_only'
      : comparisons.exclusions.awaitingOutcome > 0 ? 'awaiting_operator_outcomes' : 'no_eligible_outcomes';
}

/** Fixed aggregate only; observation reasons overlap and have no inferred denominator. */
export function readEvidenceGapAuditReport(value) {
  if (!gapAuditExact(value, ['version', 'window', 'intake', 'comparisons', 'observations', 'evidencePhase', 'limits']) ||
      value.version !== GAP_AUDIT_VERSION || !gapAuditExact(value.window, ['since', 'until', 'outcomesAsOf']) ||
      !Object.values(value.window).every(gapAuditTime) || value.window.until !== value.window.outcomesAsOf ||
      Date.parse(value.window.until) - Date.parse(value.window.since) !== 30 * 86400000 ||
      !gapAuditExact(value.intake, ['recordedMovieTvEvents', 'capped', 'withoutRetainedComparison']) ||
      !count(value.intake.recordedMovieTvEvents, 5001) || value.intake.capped !== (value.intake.recordedMovieTvEvents === 5001) ||
      !gapAuditExact(value.comparisons, ['inspected', 'eligible', 'exclusions', 'observationOverflowCaptures']) ||
      !count(value.comparisons.inspected, 5000) || !count(value.comparisons.eligible, value.comparisons.inspected) ||
      !gapAuditExact(value.comparisons.exclusions, GAP_AUDIT_CAPTURE_REASONS) ||
      !Object.values(value.comparisons.exclusions).every(n => count(n, value.comparisons.inspected)) ||
      Object.values(value.comparisons.exclusions).reduce((a, b) => a + b, value.comparisons.eligible) !== value.comparisons.inspected ||
      !count(value.comparisons.observationOverflowCaptures, value.comparisons.exclusions.invalid)) return null;
  const { intake, comparisons, observations } = value;
  if (intake.capped ? intake.withoutRetainedComparison !== null :
    intake.recordedMovieTvEvents < comparisons.inspected || intake.withoutRetainedComparison !== intake.recordedMovieTvEvents - comparisons.inspected) return null;
  if (!gapAuditExact(observations, ['scope', 'overlappingReasons', 'mayBeTruncated', 'groupsAtLimit', 'reasons']) ||
      observations.scope !== 'bounded_inspected_records' || observations.overlappingReasons !== true ||
      !count(observations.groupsAtLimit, comparisons.inspected) || observations.groupsAtLimit < comparisons.observationOverflowCaptures ||
      observations.mayBeTruncated !== (observations.groupsAtLimit > 0) ||
      !gapAuditExact(observations.reasons, GAP_AUDIT_OBSERVATION_REASONS) ||
      !Object.values(observations.reasons).every(n => count(n, comparisons.inspected * 101)) ||
      !gapAuditExact(value.limits, Object.keys(GAP_AUDIT_LIMITS)) ||
      !Object.entries(GAP_AUDIT_LIMITS).every(([key, expected]) => value.limits[key] === expected) ||
      value.evidencePhase !== gapAuditPhase(intake, comparisons)) return null;
  return value;
}
