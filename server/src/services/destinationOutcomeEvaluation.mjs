/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { groupDestinationOutcomes, destinationOutcomeBucket } from './destinationOutcomeGrouping.mjs';
import { summarizeDestinationIntakeCoverage } from './destinationIntakeCoverage.mjs';

const counters = () => ({ completedAgreement: 0, completedDisagreement: 0, awaitingDecision: 0,
  pendingRetry: 0, nonClassifier: 0, conflictingEvidence: 0, unavailableDestination: 0, missingContext: 0 });
const finish = counts => ({ ...counts, completedDecisions: counts.completedAgreement + counts.completedDisagreement,
  labeledCohortAgreementRate: counts.completedAgreement + counts.completedDisagreement === 0 ? null :
    counts.completedAgreement / (counts.completedAgreement + counts.completedDisagreement) });

/** Explicit outcome agreement is distinct from queue coverage and executed routing. */
export function evaluateDestinationOutcomes(rows, intakeRows = []) {
  const { groups, ...coverage } = groupDestinationOutcomes(rows);
  const overall = counters(), byMediaType = { movie: counters(), tv: counters() };
  let repeatedOutcomeRows = 0;
  for (const group of groups.values()) {
    repeatedOutcomeRows += group.rows - 1;
    const bucket = destinationOutcomeBucket(group);
    overall[bucket]++;
    byMediaType[group.context?.capture.mediaType ?? group.mediaType][bucket]++;
  }
  const intake = summarizeDestinationIntakeCoverage(intakeRows, groups);
  return { version: 'destination_outcomes.v2', status: rows.length || intakeRows.length ? 'complete' : 'no_eligible_outcomes',
    qualityStatus: overall.completedAgreement + overall.completedDisagreement ? 'explicit_outcome_cohort_measured' : 'no_completed_decision_labels',
    retainedRows: rows.length, uniqueDecisions: groups.size, repeatedOutcomeRows, ...coverage,
    overall: finish(overall), byMediaType: Object.fromEntries(Object.entries(byMediaType).map(([type, counts]) => [type, finish(counts)])),
    intake,
    limitations: { feedbackSelectionBias: true, notFullPipelineAccuracy: true, notExecutedRouting: true,
      historicalContextNotReconstructed: true, retentionDays: 30 },
    promotionAllowed: false, routingWrites: 0, providerCalls: 0 };
}
