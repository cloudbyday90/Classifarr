/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const tallies = eligible => ({ policyVersusChoice: { agrees: 0, differs: eligible, unavailable: 0 },
  originalVersusChoice: { agrees: 0, differs: 0, unavailable: eligible }, policyVersusOriginal: { agrees: 0, differs: 0, unavailable: eligible } })
const group = eligible => ({ eligible, comparisons: tallies(eligible) })
const gapNames = ['missing_capture', 'legacy_capture', 'expired_capture', 'capture_gap', 'invalid_capture', 'unverified_purpose',
  'no_policy_leader', 'source_only_identity', 'binding_failure', 'legacy_event', 'missing_action_evidence', 'selection_only',
  'unknown_action', 'missing_supplement', 'expired', 'conflicting', 'unavailable_destination']
export function purposeEvaluationFixture(eligible = 1) {
  return { version: 'purpose_evaluation_status.v1', status: 'complete', reason: null,
    checkedAt: '2026-10-29T12:00:00.000Z', observedAt: '2026-10-29T12:00:00.000Z', nextCheckAt: '2026-10-29T12:05:00.000Z',
    report: { version: 'purpose_evaluation.v1', window: { since: '2026-09-29T12:00:00.000Z', until: '2026-10-29T12:00:00.000Z' },
      phase: eligible ? 'diagnostic_only' : 'no_retained_choices', eligible, comparisons: tallies(eligible), cohorts: { confirmation: group(0), correction: group(eligible) },
      sources: { manual: group(eligible), runtime: group(0), history_review: group(0) },
      originalEvidence: { available: 0, not_captured: eligible, not_completed: 0, not_automated: 0 },
      coverage: { sourceRows: eligible, canonicalEvents: eligible, aliases: 0, duplicateItems: 0,
        gaps: Object.fromEntries(gapNames.map(key => [key, 0])), observedGaps: Object.fromEntries(gapNames.map(key => [key, 0])) },
      limits: { retentionDays: 30, inputEvents: 5000, inputBytes: 67108864, reportBytes: 16384, producerReadiness: 'not_assessed',
        agreementIsNotAccuracy: true, comparisonsOverlap: true, confirmationsMayBeSuggestionBiased: true,
        placementsAreNotLabels: true, providerCalls: 0, sourceWrites: 0, routingChanges: 0, learningChanges: 0 } } }
}
