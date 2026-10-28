/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { groupDestinationOutcomes, destinationOutcomeBucket } from './destinationOutcomeGrouping.mjs';
import { summarizeDestinationIntakeCoverage } from './destinationIntakeCoverage.mjs';

const counters = () => ({ completedAgreement: 0, completedDisagreement: 0, awaitingDecision: 0,
  pendingRetry: 0, nonClassifier: 0, conflictingEvidence: 0, unavailableDestination: 0, missingContext: 0 });
const finish = counts => ({ ...counts, completedDecisions: counts.completedAgreement + counts.completedDisagreement,
  labeledCohortAgreementRate: counts.completedAgreement + counts.completedDisagreement === 0 ? null :
    counts.completedAgreement / (counts.completedAgreement + counts.completedDisagreement) });

const cohort = () => ({ uniqueDecisions: 0, overall: counters(), byMediaType: { movie: counters(), tv: counters() } });
function addDecision(cohort, group, bucket) {
  cohort.uniqueDecisions++;
  cohort.overall[bucket]++;
  cohort.byMediaType[group.context?.capture.mediaType ?? group.mediaType][bucket]++;
}
const finishCohort = cohort => ({ ...cohort, overall: finish(cohort.overall),
  byMediaType: Object.fromEntries(Object.entries(cohort.byMediaType).map(([type, counts]) => [type, finish(counts)])) });

/** Explicit outcome agreement is distinct from queue coverage and executed routing. */
export function evaluateDestinationOutcomes(rows, intakeRows = [], authorizedMissingSnapshotRows = 0) {
  if (!Number.isSafeInteger(authorizedMissingSnapshotRows) || authorizedMissingSnapshotRows < 0 ||
      authorizedMissingSnapshotRows > 5000 || (Array.isArray(rows) && rows.length + authorizedMissingSnapshotRows > 5000)) throw new Error('saved_decisions_row_budget');
  const { groups, ...coverage } = groupDestinationOutcomes(rows);
  const overall = counters(), byMediaType = { movie: counters(), tv: counters() };
  const authorizedCohorts = { confirmation: cohort(), correction: cohort() };
  let repeatedOutcomeRows = 0, mixedKindDecisions = 0;
  for (const group of groups.values()) {
    repeatedOutcomeRows += group.rows - 1;
    const bucket = destinationOutcomeBucket(group);
    overall[bucket]++;
    byMediaType[group.context?.capture.mediaType ?? group.mediaType][bucket]++;
    // Stratify only after all-source conflict checks; filtering intake would hide contradictions.
    if (group.authorizedActionKinds?.size > 1) mixedKindDecisions++;
    else if (group.authorizedActionKinds?.size === 1) {
      addDecision(authorizedCohorts[[...group.authorizedActionKinds][0]], group, bucket);
    }
  }
  const intake = summarizeDestinationIntakeCoverage(intakeRows, groups);
  return { version: 'destination_outcomes.v2', status: rows.length || intakeRows.length || authorizedMissingSnapshotRows ? 'complete' : 'no_eligible_outcomes',
    qualityStatus: overall.completedAgreement + overall.completedDisagreement ? 'explicit_outcome_cohort_measured' : 'no_completed_decision_labels',
    retainedRows: rows.length, uniqueDecisions: groups.size, repeatedOutcomeRows, ...coverage,
    authorizedOutcomes: { missingSnapshotRows: authorizedMissingSnapshotRows,
      confirmationRows: rows.filter(row => row.origin === 'authorized_outcome' && row.was_correction === false).length,
      correctionRows: rows.filter(row => row.origin === 'authorized_outcome' && row.was_correction === true).length,
      mixedKindDecisions, cohorts: Object.fromEntries(Object.entries(authorizedCohorts).map(([kind, value]) => [kind, finishCohort(value)])) },
    overall: finish(overall), byMediaType: Object.fromEntries(Object.entries(byMediaType).map(([type, counts]) => [type, finish(counts)])),
    intake,
    limitations: { feedbackSelectionBias: true, confirmationsMayBeSuggestionBiased: true, notFullPipelineAccuracy: true, notExecutedRouting: true,
      historicalContextNotReconstructed: true, retentionDays: 30 },
    promotionAllowed: false, routingWrites: 0, providerCalls: 0 };
}
