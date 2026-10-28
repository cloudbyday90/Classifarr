/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { auditCaptureReasons, auditObservationReasons } from '../../utils/evidenceGapAudit.js'
export function evidenceGapAuditFixture() {
  const observedAt = '2026-10-28T12:00:00.000Z'
  return { version: 'evidence_gap_audit_status.v1', status: 'complete', reason: null, checkedAt: observedAt,
    observedAt, nextCheckAt: '2026-10-28T12:05:00.000Z', report: { version: 'evidence_gap_audit.v1',
      window: { since: '2026-09-28T12:00:00.000Z', until: observedAt, outcomesAsOf: observedAt },
      intake: { recordedMovieTvEvents: 0, capped: false, withoutRetainedComparison: 0 },
      comparisons: { inspected: 0, eligible: 0, exclusions: Object.fromEntries(auditCaptureReasons.map(key => [key, 0])), observationOverflowCaptures: 0 },
      observations: { scope: 'bounded_inspected_records', overlappingReasons: true, mayBeTruncated: false,
        groupsAtLimit: 0, reasons: Object.fromEntries(auditObservationReasons.map(key => [key, 0])) },
      evidencePhase: 'awaiting_classification_intake', limits: { retentionDays: 30, captures: 5000, observationsPerCapture: 100,
        observationSentinel: 101, historicalRecovery: 'not_assessed', notAccuracy: true, placementsAreNotEvaluationLabels: true,
        promotionAllowed: false, providerCalls: 0, sourceWrites: 0, routingWrites: 0, learningWrites: 0, importWrites: 0 } } }
}
