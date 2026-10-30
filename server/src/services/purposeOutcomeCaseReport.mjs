/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { preparePurposeOutcomeCohort } from './purposeOutcomeCohortPreparation.mjs';
import { summarizePurposeOutcomeCohort } from './purposeOutcomeCohortReport.mjs';
import { projectPurposeOutcomeCase } from './purposeOutcomeCaseProjection.mjs';
import { createPurposePolicyContextProjection } from './purposePolicyContextReport.mjs';

export const PURPOSE_OUTCOME_CASE_LIMIT = 50;
export const PURPOSE_OUTCOME_CASE_BYTES = 1048576;
const tally = () => ({ agrees: 0, differs: 0, unavailable: 0 });
const cohort = () => ({ eligible: 0, flagged: 0, policyVersusChoice: tally(), originalVersusChoice: tally(), policyVersusOriginal: tally() });

export function buildPurposeOutcomeCaseReport(input, { includePolicyContext = false } = {}) {
  const prepared = preparePurposeOutcomeCohort(input), evaluation = summarizePurposeOutcomeCohort(prepared);
  const report = { version: 'policy.purpose_outcome_cases.v1', private: true, status: evaluation.status,
    window: { since: input.window.since, until: input.window.until }, evaluation,
    comparisonCohorts: { confirmation: cohort(), correction: cohort() },
    display: { eligibleCases: evaluation.sampleSize, flaggedCases: 0, shownCases: 0, omittedCases: 0, truncated: false,
      order: 'observation_microseconds_then_exact_classification_and_source_ids',
      selection: 'policy_or_proven_original_differs_from_choice' },
    limits: { displayedCases: PURPOSE_OUTCOME_CASE_LIMIT, reportBytes: PURPOSE_OUTCOME_CASE_BYTES },
    evidenceGaps: { selectedPolicyId: 'not_captured_in_contract', fullPolicyAlternatives: 'not_in_input_contract',
      laterAiRoutingTrace: 'not_captured_in_contract', commandReferenceIds: 'source_dependent' },
    interpretation: { comparisonsOverlap: true, policyAggregateMeaningUnchanged: true, disagreementsAreNotErrorLabels: true,
      agreementIsNotAccuracy: true, laterStageCausationNotEstablished: true, confirmationsMayBeSuggestionBiased: true,
      gappedAndHeldOutDetails: 'aggregate_only', sourceReferences: 'representative_after_database_alias_deduplication',
      routingChanges: 0, learningChanges: 0, providerCalls: 0, promotionAllowed: false }, cases: [] };
  const projectContext = includePolicyContext ? createPurposePolicyContextProjection(report, input) : null;
  for (const event of prepared.events) {
    if (event.disposition !== 'eligible') continue;
    // Project/validate every eligible event, including those beyond the display prefix.
    const item = projectPurposeOutcomeCase(event), counts = report.comparisonCohorts[event.action];
    projectContext?.(event, item);
    counts.eligible++;
    for (const [comparison, status] of Object.entries(item.comparisons)) counts[comparison][status]++;
    if (!item.flags.length) continue;
    counts.flagged++; report.display.flaggedCases++;
    if (report.cases.length < PURPOSE_OUTCOME_CASE_LIMIT) report.cases.push(item);
  }
  const display = () => {
    report.display.shownCases = report.cases.length;
    report.display.omittedCases = report.display.flaggedCases - report.cases.length;
    report.display.truncated = report.display.omittedCases > 0;
  };
  display();
  while (Buffer.byteLength(JSON.stringify(report)) > PURPOSE_OUTCOME_CASE_BYTES && report.cases.length) { report.cases.pop(); display(); }
  if (Buffer.byteLength(JSON.stringify(report)) > PURPOSE_OUTCOME_CASE_BYTES) throw new Error('purpose_cases_output_budget');
  return report;
}
