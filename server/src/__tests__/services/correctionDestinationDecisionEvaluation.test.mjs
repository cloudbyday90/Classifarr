/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, afterEach } from '@jest/globals';
import { evaluateDestinationOutcomes as evaluateCorrectionDestinationDecisions } from '../../services/destinationOutcomeEvaluation.mjs';
import { readDestinationOutcomes as readCorrectionDestinationDecisions, CORRECTION_DESTINATION_DECISION_SQL,
  runDestinationOutcomeEvaluation as runCorrectionDestinationDecisionEvaluation } from '../../services/destinationOutcomeEvaluationRepository.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';
import { runOperatorCorrectionPolicyEvaluation } from '../../scripts/runOperatorCorrectionPolicyEvaluation.mjs';
import { buildFeedbackOutcomeSnapshot } from '../../services/feedbackOutcomeSnapshot.mjs';

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });
const row = (id = 1, options = {}) => {
  const { mediaType = 'movie', status = 'completed', method = 'ai_analysis', libraryId = 2, ...overrides } = options;
  return { media_type: mediaType, identity_key: `${mediaType}:42`, selected_library_id: 3, target_available: true,
    decision_context: { classificationId: id, capture: buildClassificationDestinationDecision({
      metadata: { media_type: mediaType, tmdb_id: 42 }, method, status, libraryId: status === 'completed' ? libraryId : null }) }, ...overrides };
};

test('reports no labels honestly and enforces the all-or-nothing read budget', () => {
  expect(evaluateCorrectionDestinationDecisions([])).toMatchObject({ status: 'no_eligible_outcomes',
    qualityStatus: 'no_completed_decision_labels', overall: { labeledCohortAgreementRate: null } });
  for (const input of [null, Array(5001).fill(row())]) expect(() => evaluateCorrectionDestinationDecisions(input)).toThrow('row_budget');
});

test('partitions completed decisions, review, retry and non-classifier context without routing claims', () => {
  const result = evaluateCorrectionDestinationDecisions([row(1), row(2, { mediaType: 'tv', libraryId: 3 }),
    row(3, { status: 'awaiting_decision' }), row(4, { status: 'pending_retry' }), row(5, { method: 'source_library' }),
    row(6, { method: 'manual_classification' }), row(7, { target_available: false }),
    row(8, { decision_context: null }), row(9, { media_type: 'music' })]);
  expect(result).toMatchObject({ uniqueDecisions: 7, missingContextRows: 1, excludedMediaRows: 1,
    overall: { completedAgreement: 1, completedDisagreement: 1, completedDecisions: 2, labeledCohortAgreementRate: 0.5,
      awaitingDecision: 1, pendingRetry: 1, nonClassifier: 2, unavailableDestination: 1 },
    byMediaType: { tv: { completedAgreement: 1 }, movie: { completedDisagreement: 1 } },
    limitations: { notFullPipelineAccuracy: true, notExecutedRouting: true }, promotionAllowed: false, routingWrites: 0, providerCalls: 0 });
  expect(JSON.stringify(result)).not.toMatch(/movie:42|classificationId|libraryId|identity_key/);
});

test('deduplicates repeated feedback and excludes conflicting labels, identity or captures', () => {
  const result = evaluateCorrectionDestinationDecisions([row(1), row(1), row(2), row(2, { selected_library_id: 4 }),
    row(3), row(3, { libraryId: 4 }), row(4), row(4, { identity_key: 'movie:43' }),
    row(5), row(5, { selected_library_id: 0 }), row(6), row(6, { target_available: false })]);
  expect(result).toMatchObject({ uniqueDecisions: 6, repeatedOutcomeRows: 6, invalidIdentityRows: 2,
    overall: { completedDisagreement: 1, conflictingEvidence: 4, unavailableDestination: 1 } });
});

test('source-only observations are not classifier decisions; malformed identifiers never become labels', () => {
  const source = row(1, { method: 'source_library', identity_key: `source:${'a'.repeat(64)}` });
  source.decision_context.capture.tmdbId = null;
  expect(evaluateCorrectionDestinationDecisions([source]).overall.nonClassifier).toBe(1);
  expect(evaluateCorrectionDestinationDecisions([{ ...source, identity_key: 'source:bad' }]).overall.conflictingEvidence).toBe(1);
  expect(evaluateCorrectionDestinationDecisions([row(2, { media_type: 'tv' })]).overall.conflictingEvidence).toBe(1);
});

test('known lineage with an invalid capture poisons the decision regardless of row order', () => {
  const bad = row(1, { decision_context: { classificationId: 1, capture: {} } });
  for (const rows of [[bad, row(1)], [row(1), bad]]) {
    expect(evaluateCorrectionDestinationDecisions(rows)).toMatchObject({ missingContextRows: 1,
      overall: { completedDecisions: 0, conflictingEvidence: 1 } });
  }
  expect(evaluateCorrectionDestinationDecisions([bad]).overall.missingContext).toBe(1);
});

test('reader uses bounded statements with read-time expiry, not history or model state', async () => {
  const client = { query: jest.fn().mockResolvedValueOnce({ rows: [row()] }).mockResolvedValue({ rows: [] }) };
  expect((await readCorrectionDestinationDecisions(client)).overall.completedDisagreement).toBe(1);
  expect(client.query).toHaveBeenCalledWith(CORRECTION_DESTINATION_DECISION_SQL, [5001]);
  expect(CORRECTION_DESTINATION_DECISION_SQL).toMatch(/INTERVAL '30 days'/);
  expect(CORRECTION_DESTINATION_DECISION_SQL).not.toMatch(/classification_history|api_key|title/);
});

test('reader combines confirmations and corrections once and keeps intake coverage distinct', async () => {
  const original = row(1, { libraryId: 3 });
  const snapshot = buildFeedbackOutcomeSnapshot({ id: 1, media_type: 'movie', tmdb_id: 42, method: 'ai_analysis',
    metadata: { classification_details: { destination_decision: original.decision_context.capture } } }, 3);
  const client = { query: jest.fn().mockResolvedValueOnce({ rows: [original] }).mockResolvedValueOnce({ rows: [
    { classification_id: '1', outcome_snapshot: snapshot, target_available: true },
  ] }).mockResolvedValueOnce({ rows: [{ classification_id: 1, decision_context: original.decision_context, status_id: 'completed' }] }) };
  expect(await readCorrectionDestinationDecisions(client)).toMatchObject({ retainedRows: 2, uniqueDecisions: 1,
    repeatedOutcomeRows: 1, overall: { completedAgreement: 1 }, intake: { overall: { labelCoverageRate: 1 } } });
});

test('missing feedback context with known lineage cannot hide conflicting labels', async () => {
  const snapshot = buildFeedbackOutcomeSnapshot({ id: 1, media_type: 'movie', tmdb_id: 42, metadata: {} }, 3);
  const client = { query: jest.fn().mockResolvedValueOnce({ rows: [row(1)] }).mockResolvedValueOnce({ rows: [
    { classification_id: '1', outcome_snapshot: snapshot, target_available: true },
  ] }).mockResolvedValueOnce({ rows: [] }) };
  expect(await readCorrectionDestinationDecisions(client)).toMatchObject({ missingContextRows: 1,
    overall: { completedDecisions: 0, conflictingEvidence: 1 } });
});

test.each([null, {}, { version: 'unknown' }])('reader rejects corrupted feedback rather than returning a partial metric', async outcome_snapshot => {
  const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ classification_id: 1, outcome_snapshot }] }) };
  await expect(readCorrectionDestinationDecisions(client)).rejects.toThrow('feedback_invalid');
});

test('reader enforces combined row cap and exact feedback lineage', async () => {
  const client = { query: jest.fn().mockResolvedValueOnce({ rows: Array(5000).fill(row()) })
    .mockResolvedValueOnce({ rows: [{}] }) };
  await expect(readCorrectionDestinationDecisions(client)).rejects.toThrow('row_budget');
  const snapshot = buildFeedbackOutcomeSnapshot({ id: 1, media_type: 'movie', tmdb_id: 42, method: 'ai_analysis',
    metadata: { classification_details: { destination_decision: row().decision_context.capture } } }, 3);
  client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ classification_id: 2, outcome_snapshot: snapshot }] });
  await expect(readCorrectionDestinationDecisions(client)).rejects.toThrow('feedback_invalid');
});

test.each([['--source-pair'], ['--size', '100'], ['--generate-cases', '1'], ['--folds', '3'], ['--seed', 'test'], ['--max-minutes', '1']])(
  'saved decision mode rejects unrelated flags: %j', async (...flags) => {
    const evaluate = jest.fn();
    await expect(runOperatorCorrectionPolicyEvaluation({ argv: ['--saved-decisions', ...flags], evaluate })).rejects.toThrow('fixed_retention');
    expect(evaluate).not.toHaveBeenCalled();
  });

test('CLI invokes saved-decision mode without models or benchmark options', async () => {
  const evaluate = jest.fn(async () => ({ status: 'no_eligible_corrections' }));
  await expect(runOperatorCorrectionPolicyEvaluation({ argv: ['--saved-decisions'], evaluate })).resolves.toEqual({ status: 'no_eligible_corrections' });
  expect(evaluate).toHaveBeenCalledWith();
  expect(process.env.PGOPTIONS).toContain('default_transaction_read_only=on');
  expect(process.env.FILE_LOGGING_ENABLED).toBe('false');
});

test('runtime rejects absent private startup flags before connecting', async () => {
  delete process.env.PGOPTIONS;
  await expect(runCorrectionDestinationDecisionEvaluation()).rejects.toThrow('private_runtime_required');
});

test.each([false, true])('runtime protects reads and closes the connection on failure=%s', async fail => {
  process.env.PGOPTIONS = '-c default_transaction_read_only=on';
  const client = { query: jest.fn(async sql => {
    if (sql === CORRECTION_DESTINATION_DECISION_SQL) {
      if (fail) throw new Error('synthetic read failure');
      return { rows: [] };
    }
    return { rows: [] };
  }), release: jest.fn() };
  const pool = { connect: jest.fn(async () => client), end: jest.fn() };
  const operation = runCorrectionDestinationDecisionEvaluation({ logging: { level: 'fatal', fileLoggingEnabled: false },
    loadDatabase: async () => ({ pool }) });
  if (fail) await expect(operation).rejects.toThrow('synthetic read failure');
  else expect((await operation).status).toBe('no_eligible_outcomes');
  expect(client.query).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  expect(client.query).toHaveBeenCalledWith(fail ? 'ROLLBACK' : 'COMMIT');
  expect(client.release).toHaveBeenCalledTimes(1);
  expect(pool.end).toHaveBeenCalledTimes(1);
});
