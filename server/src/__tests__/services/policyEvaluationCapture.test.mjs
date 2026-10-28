/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { evaluateItem } from '../../services/policyEngineEvaluation.mjs';
import { createLivePolicyEvaluationCapture, getLivePolicyEvaluationCapture as captureOf,
  holdPolicyEvaluationCapture, projectHeldPolicyEvaluationCapture } from '../../services/policyEvaluationCapture.mjs';
import { validPolicyEvaluationCapture, policyEvaluationPayloadBytes } from '../../services/policyEvaluationCaptureContract.mjs';
import { persistPolicyEvaluationCapture } from '../../services/policyEvaluationCaptureRepository.mjs';
import { policyEvaluationFixture, mintPolicyEvaluationFixture } from '../fixtures/policyEvaluationCaptureFixture.mjs';

test.each(['declared_native', 'profile_derived', 'mixed', 'unverified'])('freezes %s provenance independently of admission without raw values', provenance => {
  const { capture } = mintPolicyEvaluationFixture(undefined, { provenance });
  expect(validPolicyEvaluationCapture(capture.payload)).toBe(true);
  expect(capture.payload.candidates[0].purposeProvenance).toBe(provenance);
  expect(capture.payload.candidates[0].runtime.admission).toBe(['mixed', 'profile_derived'].includes(provenance) ? 'inferred_profile_ranking' : 'not_recorded');
  expect(JSON.stringify(capture)).not.toMatch(/PRIVATE|sourceId|require_any|operator_declared_intent/);
  expect(Object.isFrozen(capture.payload.candidates[0].scores)).toBe(true);
});

test('compatibility storage does not become declared native purpose', () => {
  const { capture } = mintPolicyEvaluationFixture(undefined, { source: 'compatibility_bridge' });
  expect(capture.payload.candidates[0]).toMatchObject({ purposeProvenance: 'unverified', runtime: { eligible: null, status: 'not_applicable' } });
});

test('complete pool includes conflicts, non-comparable and ranking exclusions with final order/scores', () => {
  const rows = [1, 2, 3, 4].map(id => policyEvaluationFixture({ policyId: id, libraryId: id }));
  rows[2].evaluation.score = 0;
  const item = { media_type: 'movie', tmdb_id: 42 }, collector = createLivePolicyEvaluationCapture(item);
  collector.start(rows.map(row => row.policy), rows.map(row => row.policy), 0);
  rows.forEach(row => collector.record(row.evaluation));
  const capture = captureOf(collector.finish({ ranked: [{ ...rows[0].evaluation, score: 31 }] }, new Set([2])));
  expect(capture.payload.candidates.map(row => row.disposition)).toEqual(['ranked', 'constraint_conflict', 'non_comparable', 'ranking_excluded']);
  expect(capture.payload.ranked[0].score).toBe(31); expect(capture.payload.candidates[0].rawScore).toBe(42);
  expect(capture.payload.exclusions).toEqual({ constraint_conflict: 1, non_comparable: 1, ranking_excluded: 1 });
});

function evaluatorFixture(count = 1, live = true) {
  const item = { media_type: 'movie', tmdb_id: 42 }, rows = Array.from({ length: count }, (_, n) => policyEvaluationFixture({ policyId: n + 1 }));
  const deps = { checkAuthoritativeSignals: jest.fn(async () => null), getActivePolicies: async () => rows.map(row => row.policy),
    evaluatePolicy: jest.fn(async policy => rows.find(row => row.policy.id === policy.id).evaluation),
    applyInventoryEvidence: async ({ evaluations }) => evaluations, rankResults: async rows => rows,
    determineAction: ranked => ({ action: 'manual', ranked }) };
  if (live) deps.capturePolicyEvaluation = createLivePolicyEvaluationCapture(item);
  return { item, rows, deps, run: () => evaluateItem(item, { ragCache: { matches: [] } }, deps) };
}

test('generic offline execution defaults off; live-only hook freezes loaded purpose before scorer awaits', async () => {
  const offline = evaluatorFixture(1, false); expect(captureOf(await offline.run())).toBeNull();
  const live = evaluatorFixture();
  live.deps.evaluatePolicy.mockImplementation(async () => {
    live.rows[0].policy.policy_intent_contract.purpose[0].source = 'media_server_library_profile';
    return live.rows[0].evaluation;
  });
  expect(captureOf(await live.run()).payload.candidates[0].purposeProvenance).toBe('declared_native');
});

test('65 policies are still evaluated; diagnostic overflow never caps live scoring', async () => {
  const fixture = evaluatorFixture(65), result = await fixture.run();
  expect(fixture.deps.evaluatePolicy).toHaveBeenCalledTimes(65); expect(result.ranked).toHaveLength(65);
  expect(captureOf(result)).toMatchObject({ reasonId: 'pool_overflow', payload: null });
});

test.each(['authoritative_bypass', 'no_active_policies', 'no_compatible_policies'])('early path records %s without a fictitious policy pool', async reason => {
  const fixture = evaluatorFixture();
  if (reason === 'authoritative_bypass') fixture.deps.checkAuthoritativeSignals.mockResolvedValue({ library_id: 1, confidence: 99 });
  if (reason === 'no_active_policies') fixture.deps.getActivePolicies = async () => [];
  if (reason === 'no_compatible_policies') fixture.rows[0].policy.library_media_type = 'tv';
  expect(captureOf(await fixture.run())).toMatchObject({ reasonId: reason, payload: null });
});

test('all non-comparable evaluations preserve a complete empty ranking', async () => {
  const fixture = evaluatorFixture(); fixture.rows[0].evaluation.score = 0;
  const capture = captureOf(await fixture.run());
  expect(capture.reasonId).toBe('complete'); expect(capture.payload.ranked).toEqual([]);
  expect(capture.payload.candidates[0].disposition).toBe('non_comparable');
});

test.each(['identity', 'ranking', 'replacement', 'receipt'])('held %s mutation cannot become positive evidence', kind => {
  const fixture = mintPolicyEvaluationFixture(), held = holdPolicyEvaluationCapture(fixture.result, fixture.item);
  if (kind === 'identity') fixture.item.tmdb_id++;
  if (kind === 'ranking') fixture.retained.ranked[0].score++;
  if (kind === 'replacement') fixture.result.policyResult = mintPolicyEvaluationFixture().retained;
  if (kind === 'receipt') fixture.retained[Object.getOwnPropertySymbols(fixture.retained)[0]] = structuredClone(fixture.capture);
  expect(projectHeldPolicyEvaluationCapture(held, fixture.result, fixture.item)).toMatchObject({ reasonId: 'binding_failure', payload: null });
});

test('deserialized captures and forged held receipts have no in-process persistence authority', () => {
  const fixture = mintPolicyEvaluationFixture();
  expect(holdPolicyEvaluationCapture(structuredClone(fixture.result), fixture.item)).toBeNull();
  expect(projectHeldPolicyEvaluationCapture({ capture: fixture.capture }, fixture.result, fixture.item)).toBeNull();
});

test('exact BIGINT repository binding and zero DML for missing evidence', async () => {
  const fixture = mintPolicyEvaluationFixture(), database = { query: jest.fn(async () => ({ rowCount: 1 })) };
  const held = holdPolicyEvaluationCapture(fixture.result, fixture.item);
  expect(await persistPolicyEvaluationCapture(database, { classificationId: '9223372036854775807', held, result: fixture.result, metadata: fixture.item })).toBe(true);
  expect(database.query.mock.calls[0][1][0]).toBe('9223372036854775807');
  expect(database.query.mock.calls[0][0]).toContain('ON CONFLICT (classification_id) DO NOTHING');
  const replay = holdPolicyEvaluationCapture(fixture.result, fixture.item);
  expect(await persistPolicyEvaluationCapture(database, { classificationId: 2, held: replay, result: fixture.result, metadata: fixture.item })).toBe(false);
  await persistPolicyEvaluationCapture(database, { classificationId: 1, held: null }); expect(database.query).toHaveBeenCalledTimes(1);
});

test('concurrent live evaluations retain independent identities and provenance', async () => {
  const a = evaluatorFixture(), b = evaluatorFixture(); b.item.tmdb_id = 43;
  b.deps.capturePolicyEvaluation = createLivePolicyEvaluationCapture(b.item);
  b.rows[0].policy.policy_intent_contract.purpose[0] = { source: 'media_server_library_profile', inference_state: 'inferred' };
  const [left, right] = await Promise.all([a.run(), b.run()]);
  expect(captureOf(left).identityKey).toBe('movie:42');
  expect(captureOf(right).identityKey).toBe('movie:43');
  expect(captureOf(left).payload.candidates[0].purposeProvenance).toBe('declared_native');
  expect(captureOf(right).payload.candidates[0].purposeProvenance).toBe('profile_derived');
});

test('jsonb byte admission accounts for tiny exponent numbers instead of truncating', () => {
  expect(policyEvaluationPayloadBytes({ x: 1e-300 })).toBe(309);
  const rows = Array.from({ length: 64 }, (_, n) => policyEvaluationFixture({ policyId: n + 1 }));
  const item = { media_type: 'movie', tmdb_id: 42 }, collector = createLivePolicyEvaluationCapture(item);
  collector.start(rows.map(row => row.policy), rows.map(row => row.policy), 0);
  rows.forEach(row => { Object.keys(row.evaluation.weights).forEach(key => { row.evaluation.weights[key] = 1e-300; }); collector.record(row.evaluation); });
  expect(captureOf(collector.finish({ ranked: rows.map(row => row.evaluation) }))).toMatchObject({ reasonId: 'payload_overflow', payload: null });
});

test('undefined numeric inputs are invalid evidence rather than a size overflow', () => {
  const item = { media_type: 'movie', tmdb_id: 42 }, { policy, evaluation } = policyEvaluationFixture();
  delete evaluation.scores.profile;
  const collector = createLivePolicyEvaluationCapture(item);
  collector.start([policy], [policy], 0); collector.record(evaluation);
  expect(captureOf(collector.finish({ ranked: [evaluation] }))).toMatchObject({ reasonId: 'capture_invalid', payload: null });
});

test('internal capture survives in-process copies but cannot serialize into metadata, History, retries or responses', () => {
  const fixture = mintPolicyEvaluationFixture(), copy = { ...fixture.retained };
  expect(holdPolicyEvaluationCapture({ policyResult: copy }, fixture.item)?.capture).toBe(fixture.capture);
  const serialized = JSON.stringify({ policyResult: copy, metadata: { policyResult: fixture.retained } });
  expect(serialized).not.toMatch(/policy_evaluation\.v1|purposeProvenance|retainedPolicyEvaluationCapture/);
  expect(captureOf(JSON.parse(JSON.stringify(copy)))).toBeNull();
});
