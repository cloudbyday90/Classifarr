/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { purposeCohortRow, purposeCohortInput, PURPOSE_COHORT_NOW } from '../fixtures/purposeOutcomeFixture.mjs';
import { buildPurposeOutcomeCaseReport } from '../../services/purposeOutcomeCaseReport.mjs';
import { buildPurposeOutcomeCohortReport } from '../../services/purposeOutcomeCohortReport.mjs';
import { preparePurposeOutcomeCohort } from '../../services/purposeOutcomeCohortPreparation.mjs';
import { projectPurposeOutcomeCase } from '../../services/purposeOutcomeCaseProjection.mjs';
import { readPurposeOutcomeCases } from '../../services/purposeOutcomeCaseRead.mjs';
import { runInventoryOutcomeCalibration } from '../../scripts/runInventoryOutcomeCalibration.mjs';

const report = rows => buildPurposeOutcomeCaseReport(purposeCohortInput(rows));
const context = (libraryId = 1, method = 'ai_analysis', status = 'completed') => ({ classificationId: 1,
  capture: { version: 'classification.destination_decision.v1', mediaType: 'movie', tmdbId: 42, method, status, libraryId } });
function historyReview(classificationId = '9223372036854775807', decisionContext = null) {
  const row = purposeCohortRow({ classificationId }), reviewId = 'aa260079-f1d0-4f4c-b020-686a27cfdd72';
  row.origin = 'feedback'; row.event_key = `feedback_review:${classificationId}`;
  row.source = { classification_id: classificationId, feedback_id: 1, intake: 'standalone', review_id: reviewId,
    review_actor_fingerprint: 'a'.repeat(64), target_available: true,
    snapshot: { version: 'classification.feedback_outcome.v3', classificationId, mediaType: 'movie', tmdbId: 42,
      selectedLibraryId: 4, decisionContext, action: 'correction', intake: 'standalone', reference: {
        kind: 'original_automated_destination', libraryId: 1, reviewId, actorFingerprint: 'a'.repeat(64),
        sourceVersion: 'b'.repeat(64), issuedAt: '2026-10-29T09:59:00.000Z', expiresAt: '2026-10-29T10:09:00.000Z' } } };
  Object.assign(row.supplement, { event_key: row.event_key, authorized_receipt_id: null, feedback_classification_id: classificationId,
    source_kind: 'history_review', action_reference: 'original_automated_destination' });
  return row;
}

test('an independently proven original disagreement is visible even when the policy agrees with the choice', () => {
  const row = purposeCohortRow(); row.source.decision_context = context();
  const result = report([row]), item = result.cases[0];
  expect(item.comparisons).toEqual({ policyVersusChoice: 'agrees', originalVersusChoice: 'differs', policyVersusOriginal: 'differs' });
  expect(item.original).toEqual({ status: 'available', libraryId: 1, evidenceKind: 'frozen_decision_context', method: 'ai_analysis' });
  expect(item.action).toEqual({ kind: 'correction', reference: { kind: 'manual_prior_destination', status: 'not_captured', libraryId: null } });
  expect(result.comparisonCohorts.correction).toMatchObject({ eligible: 1, flagged: 1, originalVersusChoice: { agrees: 0, differs: 1, unavailable: 0 } });
  expect(JSON.stringify(result.evaluation)).toBe(JSON.stringify(buildPurposeOutcomeCohortReport(purposeCohortInput([row]))));
});

test.each([
  [4, 4, [], 'agrees', 'agrees', 'agrees'],
  [5, 5, ['policyVersusChoice', 'policyVersusOriginal'], 'differs', 'agrees', 'differs'],
  [5, 1, ['policyVersusChoice', 'originalVersusChoice', 'policyVersusOriginal'], 'differs', 'differs', 'differs'],
])('separates all comparisons for choice %i and original %i', (destination, original, flags, policyChoice, originalChoice, policyOriginal) => {
  const row = purposeCohortRow({ destination, action: 'confirmation' }); row.source.decision_context = context(original);
  const result = report([row]);
  expect(result.display.flaggedCases).toBe(flags.length ? 1 : 0);
  if (flags.length) {
    expect(result.cases[0].flags).toEqual(flags);
    expect(result.cases[0].action.kind).toBe('confirmation');
    expect(Object.values(result.cases[0].comparisons)).toEqual([policyChoice, originalChoice, policyOriginal]);
  }
  expect(result.comparisonCohorts.confirmation.eligible).toBe(1);
});

test.each([[null, 'not_captured'], [context(null, 'ai_analysis', 'awaiting_decision'), 'not_completed'],
  [context(1, 'manual_correction'), 'not_automated']])('does not invent an original or command reference from incomplete evidence', (value, status) => {
  const row = purposeCohortRow({ destination: 5 }); row.source.decision_context = value;
  expect(report([row]).cases[0]).toMatchObject({ original: { status, libraryId: null, method: null },
    comparisons: { policyVersusChoice: 'differs', originalVersusChoice: 'unavailable', policyVersusOriginal: 'unavailable' } });
});

test.each([['9223372036854775807', null], ['1', context()]])('History review preserves independent original binding for exact ID %s', (id, value) => {
  const result = report([historyReview(id, value)]), item = result.cases[0];
  expect(item.classificationId).toBe(id); expect(item.source).toEqual({ kind: 'history_review', referenceKind: 'feedback_receipt', id });
  expect(item.original).toEqual({ status: 'available', libraryId: 1, evidenceKind: 'history_review_original_reference', method: value ? 'ai_analysis' : null });
  expect(item.action.reference).toEqual({ kind: 'original_automated_destination', status: 'available', libraryId: 1 });
  expect(item.comparisons.originalVersusChoice).toBe('differs');
});

test('exact source IDs, typed identity and microseconds survive ordering without opaque event keys', () => {
  const movie = purposeCohortRow({ destination: 5, classificationId: '9223372036854775807' });
  movie.source.source_id = '9223372036854775806';
  movie.observed_order = String(BigInt(movie.observed_order) + 999n);
  const tv = purposeCohortRow({ destination: 5, classificationId: '9223372036854775806', mediaType: 'tv' });
  const result = report([movie, tv]);
  expect(result.cases.map(item => item.identity.mediaType)).toEqual(['tv', 'movie']);
  expect(result.cases[1].source.id).toBe('9223372036854775806');
  expect(result.cases[1].observedAt).toBe('2026-10-29T10:00:00.000999Z');
});

test('gapped and conflicted first events reserve connected items without exposing their details', () => {
  const missing = purposeCohortRow({ tmdbId: 142 }); missing.supplement = null;
  const retry = purposeCohortRow({ classificationId: '2', tmdbId: 142, destination: 5, at: '2026-10-29T11:00:00.000Z' });
  const conflict = purposeCohortRow({ classificationId: '3', tmdbId: 143, destination: 5 }), copy = structuredClone(conflict);
  copy.source.selected_library_id = 4; copy.source.target_available = false;
  for (const rows of [[missing, retry, conflict, copy], [copy, conflict, retry, missing]]) {
    const result = report(rows);
    expect(result.cases).toEqual([]); expect(result.evaluation.sampleSize).toBe(0);
    expect(result.evaluation.coverage).toMatchObject({ duplicateItems: 1, gaps: { missing_supplement: 1, conflicting: 1 } });
    expect(JSON.stringify(result)).not.toMatch(/movie:142|"tmdbId":14[23]/);
  }
});

test('validates the entire 5,000-event window before showing a deterministic 50-case prefix', () => {
  const rows = Array.from({ length: 5000 }, (_, index) => purposeCohortRow({ classificationId: String(index + 1), tmdbId: index + 1, destination: 5 }));
  const result = report(rows.toReversed());
  expect(result.display).toMatchObject({ eligibleCases: 5000, flaggedCases: 5000, shownCases: 50, omittedCases: 4950, truncated: true });
  expect(result.cases.at(-1).classificationId).toBe('50');
  expect(result.comparisonCohorts.correction.policyVersusChoice.differs).toBe(5000);
  expect(JSON.stringify(result.evaluation)).toBe(JSON.stringify(buildPurposeOutcomeCohortReport(purposeCohortInput(rows))));
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(1048576);
  // An alias after the display prefix invalidates the earlier case before selection.
  const alias = structuredClone(rows[0]); alias.source.selected_library_id = 4;
  const conflicted = report([...rows.slice(0, 60), alias]);
  expect(conflicted.cases[0].classificationId).toBe('2'); expect(conflicted.evaluation.coverage.gaps.conflicting).toBe(1);
  rows.at(-1).supplement.payload.purposeEvidence.raw = 'PRIVATE';
  expect(() => report(rows)).toThrow('invalid_supplement');
});

test('closed projection excludes raw metadata, fingerprints, opaque runtime event keys and source extras', () => {
  const row = purposeCohortRow({ destination: 5, eventKey: `runtime_resolution:1:${'q'.repeat(22)}` });
  Object.assign(row.supplement, { source_kind: 'runtime', action_reference: 'runtime_answer_contract' });
  row.source.extra = { title: 'PRIVATE TITLE', actorId: 'PRIVATE ACTOR', fingerprint: 'PRIVATE HASH' }; row.extra = 'PRIVATE';
  const result = report([row]), serialized = JSON.stringify(result);
  expect(serialized).not.toMatch(/PRIVATE|qqqq|eventKey|actorId|fingerprint|snapshot|title|rule|prompt/);
  expect(result.cases[0].action.reference).toEqual({ kind: 'runtime_answer_contract', status: 'not_captured', libraryId: null });
  expect(result.evidenceGaps).toEqual({ selectedPolicyId: 'not_captured_in_contract', fullPolicyAlternatives: 'not_in_input_contract',
    laterAiRoutingTrace: 'not_captured_in_contract', commandReferenceIds: 'source_dependent' });
});

test('projection rejects unbound or contradictory evidence rather than printing a partial case', () => {
  const event = preparePurposeOutcomeCohort(purposeCohortInput([purposeCohortRow({ destination: 5 })])).events[0];
  expect(() => projectPurposeOutcomeCase({ ...event, disposition: 'gap' })).toThrow('invalid_event');
  expect(() => projectPurposeOutcomeCase({ ...event, referenceBinding: context(2) , classificationId: '2' })).toThrow('reference_binding');
  const review = preparePurposeOutcomeCohort(purposeCohortInput([historyReview()])).events[0];
  expect(() => projectPurposeOutcomeCase({ ...review, referenceBinding: ['original_automated_destination', 0, null] })).toThrow('reference_binding');
});

function runtimeFixture(headers = [{ events: 0, payload_bytes: '0', input: null }]) {
  const client = { query: jest.fn(async sql => sql.startsWith('SELECT date_trunc') ? { rows: [{ observed_at: PURPOSE_COHORT_NOW }] } :
    sql.startsWith('WITH authorized') ? { rows: headers } : { rows: [] }) };
  return { client, close: jest.fn(), withTransaction: jest.fn(async callback => callback(client)) };
}
test('exclusive CLI mode closes its bounded read-only runtime and removes cancellation listeners', async () => {
  const runtime = runtimeFixture(), signal = new AbortController().signal, counts = ['SIGINT', 'SIGTERM'].map(name => process.listenerCount(name));
  const result = await runInventoryOutcomeCalibration({ argv: ['--prospective-purpose-cases'], signal, load: async () => runtime });
  expect(result.cases).toEqual([]); expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(runtime.withTransaction.mock.calls[0][1]).toMatchObject({ readOnly: true, isolationLevel: 'repeatable_read', timeoutMs: 15000 });
  expect(runtime.client.query.mock.calls[0][0]).toMatch(/statement_timeout='12s'.*lock_timeout='1s'.*transaction_timeout='15s'/);
  expect(['SIGINT', 'SIGTERM'].map(name => process.listenerCount(name))).toEqual(counts);
});
test.each(['--prospective', '--prospective-purpose', '--prospective-disagreements', '--since=2026-10-01'])('rejects mixed %s before loading any runtime', async option => {
  const load = jest.fn();
  await expect(runInventoryOutcomeCalibration({ argv: ['--prospective-purpose-cases', option], load })).rejects.toThrow('mode_options');
  expect(load).not.toHaveBeenCalled();
});
test.each([{ events: 5001, payload_bytes: '1', input: null }, { events: 1, payload_bytes: '67108865', input: null },
  { events: 1, payload_bytes: '1', input: null }])('read admission cannot emit a partial report and still closes its runtime', async header => {
  const runtime = runtimeFixture([header]);
  await expect(runInventoryOutcomeCalibration({ argv: ['--prospective-purpose-cases'], load: async () => runtime })).rejects.toThrow('purpose_cohort_');
  expect(runtime.close).toHaveBeenCalledTimes(1);
});
test('already cancelled read performs no query', async () => {
  const runtime = runtimeFixture(), controller = new AbortController(); controller.abort();
  await expect(readPurposeOutcomeCases(runtime, { signal: controller.signal })).rejects.toThrow();
  expect(runtime.client.query).not.toHaveBeenCalled();
});
