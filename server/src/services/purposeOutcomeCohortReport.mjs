/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { preparePurposeOutcomeCohort } from './purposeOutcomeCohortPreparation.mjs';
import { PURPOSE_OUTCOME_GAPS } from './purposeOutcomeReference.mjs';

const counts = () => ({ sampled: 0, agrees: 0, differs: 0 });
const bump = (metrics, agrees) => { metrics.sampled++; metrics[agrees ? 'agrees' : 'differs']++; };

/** Aggregate-only policy reference comparisons. No IDs, raw snapshots, actor hashes or titles leave this reducer. */
export function buildPurposeOutcomeCohortReport(input) {
  return summarizePurposeOutcomeCohort(preparePurposeOutcomeCohort(input));
}

/** Shared internal prepared cohort. Property order and meanings preserve the original aggregate protocol. */
export function summarizePurposeOutcomeCohort({ events, sourceRows, window }) {
  const report = { version: 'policy.purpose_outcome_cohort.v1', private: true, status: 'awaiting_eligible_outcomes', window,
    scope: 'existing_canonical_explicit_choice_sources', sampleSize: 0,
    cohorts: { confirmation: counts(), correction: counts() },
    sources: Object.fromEntries(['manual', 'runtime', 'history_review'].map(key => [key, counts()])),
    actionReferences: Object.fromEntries(['manual_prior_destination', 'runtime_answer_contract', 'original_automated_destination'].map(key => [key, counts()])),
    purposes: {}, coverage: { sourceRows, canonicalEvents: events.length, aliases: sourceRows - events.length,
      duplicateItems: 0, gaps: Object.fromEntries([...PURPOSE_OUTCOME_GAPS, 'missing_action_evidence', 'selection_only', 'unknown_action',
        'missing_supplement', 'expired', 'conflicting', 'unavailable_destination'].map(reason => [reason, 0])) },
    limits: { retentionDays: 30, inputEvents: 5000, inputBytes: 67108864, outputBytes: 1048576 },
    interpretation: { reference: 'retained_leading_policy_candidate', originalAutomatedDestinationCompared: false,
      actionMeaningPreserved: true, agreementIsNotAccuracy: true, disagreementsAreNotErrorLabels: true,
      confirmationsMayBeSuggestionBiased: true, legacyStatisticsUnchanged: true, noReceiptPopulation: 'unassessed',
      automaticPopulation: 'excluded', routingChanges: 0, learningChanges: 0, providerCalls: 0, promotionAllowed: false } };
  report.interpretation.holdoutOrder = 'observation_microseconds_then_exact_classification_and_source_ids';
  report.coverage.observedGaps = { ...report.coverage.gaps };
  report.coverage.gapScope = 'first_chronological_item_events';
  report.coverage.observedGapScope = 'all_canonical_events_including_holdouts';
  for (const event of events) if (event.gap) report.coverage.observedGaps[event.gap]++;
  for (const event of events) {
    if (event.disposition === 'duplicate_item') { report.coverage.duplicateItems++; continue; }
    if (event.gap) { report.coverage.gaps[event.gap]++; continue; }
    if (!event.payload || !report.cohorts[event.action]) throw new Error('purpose_cohort_invalid_event');
    const proof = event.payload.purposeEvidence, agrees = event.payload.libraryId === event.destination;
    const key = [event.action, event.sourceKind, event.actionReference, proof.origin, proof.declaredMatch,
      proof.runtimeEligible ? 'eligible' : 'ineligible', proof.specificity].join(':');
    if (!report.purposes[key]) report.purposes[key] = counts();
    bump(report.purposes[key], agrees); bump(report.cohorts[event.action], agrees);
    bump(report.sources[event.sourceKind], agrees); bump(report.actionReferences[event.actionReference], agrees);
    report.sampleSize++;
  }
  if (report.sampleSize) report.status = 'diagnostic_only';
  if (Buffer.byteLength(JSON.stringify(report)) > 1048576) throw new Error('purpose_cohort_output_budget');
  return report;
}
