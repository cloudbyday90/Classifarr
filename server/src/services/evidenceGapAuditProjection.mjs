/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateInventoryProspectiveOutcomes } from './inventoryProspectiveOutcomes.mjs';
import { withInventoryProspectiveActivity } from './inventoryProspectiveActivity.mjs';
import { GAP_AUDIT_VERSION, GAP_AUDIT_CAPTURE_REASONS, GAP_AUDIT_OBSERVATION_REASONS,
  GAP_AUDIT_LIMITS, gapAuditPhase, readEvidenceGapAuditReport } from './evidenceGapAuditContract.mjs';

/** Reuse grading eligibility; publish neither predictions nor per-item evidence. */
export function buildEvidenceGapAudit({ observedAt, window, activity, rows }) {
  const evaluated = withInventoryProspectiveActivity(evaluateInventoryProspectiveOutcomes(rows,
    { now: Date.parse(observedAt) }), activity);
  const comparisons = { inspected: evaluated.coverage.captured, eligible: evaluated.sampleSize,
    exclusions: Object.fromEntries(GAP_AUDIT_CAPTURE_REASONS.map(key => [key, evaluated.coverage[key]])),
    observationOverflowCaptures: evaluated.coverage.observationOverflowCaptures };
  const intake = { recordedMovieTvEvents: evaluated.activity.recordedMovieTvEvents, capped: evaluated.activity.capped,
    withoutRetainedComparison: evaluated.activity.capped ? null : evaluated.activity.recordedMovieTvEvents - comparisons.inspected };
  const groupsAtLimit = rows.filter(row => Array.isArray(row.outcomes) && row.outcomes.length === 101).length;
  const report = { version: GAP_AUDIT_VERSION, window: { ...window, outcomesAsOf: observedAt }, intake, comparisons,
    observations: { scope: 'bounded_inspected_records', overlappingReasons: true, mayBeTruncated: groupsAtLimit > 0,
      groupsAtLimit, reasons: Object.fromEntries(GAP_AUDIT_OBSERVATION_REASONS.map(key => [key, evaluated.coverage[key]])) },
    evidencePhase: gapAuditPhase(intake, comparisons), limits: { ...GAP_AUDIT_LIMITS } };
  if (!readEvidenceGapAuditReport(report)) throw new Error('evidence_gap_audit_invalid_report');
  return report;
}
