/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { evaluateDestinationOutcomes } from '../../services/destinationOutcomeEvaluation.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';

const intake = (id, { status = 'completed', mediaType = 'movie', method = 'ai_analysis', libraryId = 2, ...rest } = {}) => ({
  classification_id: id, status_id: 'completed', decision_context: { classificationId: id,
    capture: buildClassificationDestinationDecision({ metadata: { media_type: mediaType, tmdb_id: 42 }, method,
      status, libraryId: status === 'completed' ? libraryId : null }) }, ...rest,
});
const label = (row, selected = 2) => ({ media_type: row.decision_context.capture.mediaType,
  identity_key: `${row.decision_context.capture.mediaType}:42`, selected_library_id: selected,
  decision_context: row.decision_context, target_available: true });

test('queue coverage deduplicates exact decisions and never counts silence or queue completion as success', () => {
  const rows = [intake(1), intake(1), intake(2, { mediaType: 'tv' }), intake(3, { status: 'awaiting_decision' }),
    intake(4, { status: 'pending_retry' }), intake(5, { method: 'source_library' }), intake(6, { decision_context: null }),
    { classification_id: null, status_id: 'future', decision_context: null }];
  const result = evaluateDestinationOutcomes([label(rows[0]), label(rows[3]), label(intake(9))], rows);
  expect(result.intake).toMatchObject({ queueTasks: 8, missingContextTasks: 2, nonClassifierTasks: 1,
    labeledDecisionsWithoutCapturedIntake: 1, states: { completed: 7, unknown: 1 },
    overall: { knownClassifierDecisions: 4, labeledDecisions: 2, withoutOutcome: 2, unusableOutcome: 0,
      completed: 2, awaitingDecision: 1, pendingRetry: 1, labelCoverageRate: 0.5 },
    byMediaType: { tv: { labelCoverageRate: 0 }, movie: { knownClassifierDecisions: 3 } } });
  expect(result.overall).toMatchObject({ completedAgreement: 2, awaitingDecision: 1 });
  expect(JSON.stringify(result.intake)).not.toMatch(/classificationId|tmdbId|libraryId/);
});

test.each([intake(1, { libraryId: 3 }), intake(1, { decision_context: null }),
  intake(1, { decision_context: { classificationId: 2, capture: intake(2).decision_context.capture } }),
  intake(1, { method: 'source_library' })])('conflicting or missing lineage cannot improve coverage regardless of order', bad => {
  for (const rows of [[intake(1), bad, intake(1)], [bad, intake(1)]]) {
    expect(evaluateDestinationOutcomes([label(intake(1))], rows).intake).toMatchObject({
      invalidOrConflictingDecisionIds: 1, overall: { knownClassifierDecisions: 0, labelCoverageRate: null } });
  }
});

test('labels require exact captures and usable unambiguous destinations', () => {
  const rows = [intake(1), intake(2), intake(3)];
  const outcomes = [label(intake(1, { libraryId: 3 })), label(intake(2)), label(intake(2), 3),
    { ...label(intake(3)), target_available: false }];
  expect(evaluateDestinationOutcomes(outcomes, rows).intake.overall).toMatchObject({
    knownClassifierDecisions: 3, labeledDecisions: 0, unusableOutcome: 3, labelCoverageRate: 0 });
});

test('empty, missing, invalid and over-budget intake never creates a rate', () => {
  expect(evaluateDestinationOutcomes([]).intake.overall.labelCoverageRate).toBeNull();
  expect(evaluateDestinationOutcomes([], [{ classification_id: null, decision_context: {}, status_id: 'failed' }]).intake)
    .toMatchObject({ missingContextTasks: 1, invalidOrConflictingDecisionIds: 0, states: { failed: 1 } });
  for (const rows of [null, Array(5001).fill(intake(1))]) expect(() => evaluateDestinationOutcomes([], rows)).toThrow();
});
