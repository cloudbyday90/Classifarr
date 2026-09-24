/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';
import { NON_CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { destinationOutcomeBucket, DESTINATION_OUTCOME_ROW_LIMIT } from './destinationOutcomeGrouping.mjs';

const usable = group => ['completedAgreement', 'completedDisagreement', 'awaitingDecision', 'pendingRetry'].includes(destinationOutcomeBucket(group));
const counts = () => ({ knownClassifierDecisions: 0, labeledDecisions: 0, withoutOutcome: 0,
  unusableOutcome: 0, completed: 0, awaitingDecision: 0, pendingRetry: 0 });
const finish = value => ({ ...value, labelCoverageRate: value.knownClassifierDecisions ? value.labeledDecisions / value.knownClassifierDecisions : null });

export function summarizeDestinationIntakeCoverage(rows, outcomeGroups) {
  if (!Array.isArray(rows) || rows.length > DESTINATION_OUTCOME_ROW_LIMIT) throw new Error('saved_decisions_intake_budget');
  const states = { queued: 0, processing: 0, retry_scheduled: 0, completed: 0, failed: 0, cancelled: 0, unknown: 0 };
  const decisions = new Map(), overall = counts(), byMediaType = { movie: counts(), tv: counts() };
  let missingContextTasks = 0, nonClassifierTasks = 0;
  for (const row of rows) {
    states[Object.hasOwn(states, row.status_id) ? row.status_id : 'unknown']++;
    const context = readCorrectionDecisionContext(row.decision_context);
    if (!context || context.classificationId !== row.classification_id) {
      missingContextTasks++;
      const id = positiveDatabaseInteger(row.classification_id);
      if (id) decisions.set(id, null);
      continue;
    }
    if (NON_CLASSIFIER_CAPTURE_METHODS.includes(context.capture.method)) nonClassifierTasks++;
    const previous = decisions.get(context.classificationId);
    if (previous === null) continue;
    if (previous && JSON.stringify(previous) !== JSON.stringify(context)) {
      decisions.set(context.classificationId, null);
    } else decisions.set(context.classificationId, context);
  }
  let labeledDecisionsWithoutCapturedIntake = 0;
  for (const [id, group] of outcomeGroups) {
    const context = decisions.get(id);
    if (usable(group) && (!context || NON_CLASSIFIER_CAPTURE_METHODS.includes(context.capture.method))) labeledDecisionsWithoutCapturedIntake++;
  }
  for (const [id, context] of decisions) {
    if (!context || NON_CLASSIFIER_CAPTURE_METHODS.includes(context.capture.method)) continue;
    const outcome = outcomeGroups.get(id);
    const label = !outcome ? 'withoutOutcome' : usable(outcome) && JSON.stringify(outcome.context) === JSON.stringify(context)
      ? 'labeledDecisions' : 'unusableOutcome';
    const state = context.capture.status === 'completed' ? 'completed' : context.capture.status === 'awaiting_decision' ? 'awaitingDecision' : 'pendingRetry';
    for (const target of [overall, byMediaType[context.capture.mediaType]]) {
      target.knownClassifierDecisions++;
      target[label]++;
      target[state]++;
    }
  }
  return { scope: 'retained_queue_decision_events', queueTasks: rows.length, states,
    missingContextTasks, nonClassifierTasks,
    invalidOrConflictingDecisionIds: [...decisions.values()].filter(value => value === null).length,
    labeledDecisionsWithoutCapturedIntake,
    overall: finish(overall), byMediaType: Object.fromEntries(Object.entries(byMediaType).map(([type, value]) => [type, finish(value)])),
    notUniqueMediaItems: true, unknownDoesNotMeanCorrect: true };
}
