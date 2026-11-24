/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { createAutomaticSourcePairEvaluation, AUTOMATIC_SOURCE_PAIR_LOCK } from '../../services/automaticSourcePairEvaluation.mjs';
import { computeAutomaticSourcePair } from '../../services/automaticSourcePairComputation.mjs';
import { freezeAutomaticSourcePairCohort, validSourcePairCohort } from '../../services/automaticSourcePairCohort.mjs';
import { readAutomaticSourcePairReport } from '../../services/automaticSourcePairReport.mjs';
import { sourcePairFixture, sourcePairSnapshot, sourcePairIdentity } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { createSourcePairTaskError, readSourcePairTaskFailure } from '../../services/automaticSourcePairTaskFailure.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { readSourceDescriptionEvaluationSnapshot } from '../../services/sourceDescriptionEvaluationRuntime.mjs';

const captured = (source = sourcePairFixture()) => ({ observedAt: '2026-09-25 01:00:00.123456+00',
  inputs: { source, identity: sourcePairIdentity, configuration: 'a'.repeat(64) } });
const checkpoint = result => ({ status: 'complete', report: result.report, input_fingerprint: result.fingerprint,
  cohort: result.cohort, cohort_created_at: result.cohortCreatedAt });

test('freezes up to 300 balanced movie/TV cases, compares identical arms and reuses unchanged results', () => {
  const snapshot = captured(sourcePairFixture(400));
  const result = computeAutomaticSourcePair(snapshot, null);
  expect(result.report).toMatchObject({ status: 'complete', sampled: 300, sampleShortfall: 0,
    qualityStatus: 'no_correction_labels', limits: { providerCalls: 0, routingWrites: 0, promotionAllowed: false } });
  expect(result.report.coverage.movie).toBeGreaterThan(0); expect(result.report.coverage.tv).toBeGreaterThan(0);
  expect(result.report.coverage.sampledLibraries).toBe(4);
  const evaluate = jest.fn();
  const reused = computeAutomaticSourcePair(snapshot, checkpoint(result), { evaluate });
  expect(reused.unchanged).toBe(true); expect(evaluate).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|localhost|external_id|library_id/);
});

test('model/cache/metadata/feedback changes re-evaluate the same frozen cases; new items do not replace them', () => {
  const snapshot = captured(), first = computeAutomaticSourcePair(snapshot, null), state = checkpoint(first);
  snapshot.inputs.identity = { ...sourcePairIdentity, digest: 'b'.repeat(64) };
  const changed = computeAutomaticSourcePair(snapshot, state);
  expect(changed.fingerprint).not.toBe(first.fingerprint); expect(changed.cohort).toEqual(first.cohort);
  snapshot.inputs.source = sourcePairFixture(60);
  const added = computeAutomaticSourcePair(snapshot, checkpoint(changed));
  expect(added.report.sampled).toBe(48); expect(added.cohort).toEqual(first.cohort);
  snapshot.inputs.source.operatorFeedbackRows = [{ media_type: 'movie', tmdb_id: 1, selected_library_id: 2, was_correction: true }];
  const feedback = computeAutomaticSourcePair(snapshot, checkpoint(added));
  expect(feedback.report.metrics.correctionCases).toBe(1); expect(feedback.cohort).toEqual(first.cohort);
  expect(feedback.fingerprint).not.toBe(added.fingerprint);
  snapshot.inputs.source.candidateMetadata.get('movie:1').studio = 'Changed';
  expect(computeAutomaticSourcePair(snapshot, checkpoint(feedback)).fingerprint).not.toBe(feedback.fingerprint);
});

test('expired vectors produce no scores and automatically resume after cache fill', () => {
  const snapshot = captured(), [hash, vector] = [...snapshot.inputs.source.vectors][0];
  snapshot.inputs.source.vectors.delete(hash);
  const waiting = computeAutomaticSourcePair(snapshot, null);
  expect(waiting.report).toMatchObject({ status: 'cache_incomplete', metrics: null, coverage: { missingCachedDescriptions: 1 } });
  snapshot.inputs.source.vectors.set(hash, vector);
  const recovered = computeAutomaticSourcePair(snapshot, checkpoint(waiting));
  expect(recovered.report.status).toBe('complete'); expect(recovered.cohort).toEqual(waiting.cohort);
});

test.each(['removed', 'description', 'alias', 'expired', 'future', 'invalid'])('cohort rotation is explicit for %s', change => {
  const snapshot = captured(), first = computeAutomaticSourcePair(snapshot, null), state = checkpoint(first);
  const rows = snapshot.inputs.source.rows;
  if (change === 'removed') rows.pop();
  if (change === 'description') rows[0].overview = 'Changed description';
  if (change === 'alias') { rows[0].imdb_id = 'tt1234567'; rows[1].imdb_id = 'tt1234567'; }
  if (change === 'expired') state.cohort_created_at = '2026-08-01';
  if (change === 'future') state.cohort_created_at = '2026-10-01';
  if (change === 'invalid') state.cohort = ['private'];
  snapshot.inputs.source = sourcePairSnapshot(rows, snapshot.inputs.source.libraries);
  const next = computeAutomaticSourcePair(snapshot, state);
  expect(next.report.cohortReason).toBe(['removed', 'description', 'alias'].includes(change) ? 'source_changed' : 'expired');
  expect(validSourcePairCohort(next.cohort)).toBe(true);
});

test('an empty installation is reconsidered when inventory appears', () => {
  const first = computeAutomaticSourcePair(captured(sourcePairFixture(0)), null);
  expect(first.report.status).toBe('no_eligible_cases');
  expect(computeAutomaticSourcePair(captured(), checkpoint(first)).report.sampled).toBe(48);
  expect(() => freezeAutomaticSourcePairCohort({ ...sourcePairFixture(), operatorFeedbackRows: null }, null, '2026-09-25')).toThrow();
});

test('report reader rejects arbitrary content, unsafe authority claims, invalid counts and changed shapes', () => {
  const { report } = computeAutomaticSourcePair(captured(), null);
  for (const mutate of [value => { value.private = 'secret'; }, value => { value.limits.providerCalls = 1; },
    value => { value.limits.fullPipelineAccuracy = 1; }, value => { value.sampled = -1; },
    value => { value.metrics.cases++; }, value => { value.snapshotFingerprint = 'private'; },
    value => { value.metrics.baseline.candidateRecallAt3 = Infinity; }, value => { value.coverage.movie++; },
    value => { value.durationMs = 120001; }, value => { value.status = 'unknown'; }]) {
    const value = structuredClone(report); mutate(value); expect(readAutomaticSourcePairReport(value)).toBeNull();
  }
  const reordered = JSON.parse(JSON.stringify(report), (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).reverse()) : value);
  expect(readAutomaticSourcePairReport(reordered)).not.toBeNull();
  expect(validSourcePairCohort(['a'.repeat(64), 'a'.repeat(64)])).toBe(false);
});

function fixture() {
  const repository = { readState: jest.fn(async () => null), readSnapshot: jest.fn(async () => captured()), save: jest.fn(), fail: jest.fn() };
  const options = { repository, withSessionAdvisoryLock: jest.fn(async (_key, callback) => { await callback(); return true; }),
    withAdmission: jest.fn(async (callback, { signal }) => callback(signal)), evaluate: jest.fn(computeAutomaticSourcePair) };
  return { ...options, worker: createAutomaticSourcePairEvaluation(options) };
}

test.each(['advisory_lock', 'state_read', 'admission', 'snapshot_read', 'quality_collection', 'evaluation', 'publication'])(
  'observes the genuine %s rejection without including its details', async stage => {
    const f = fixture();
    const error = Object.assign(new Error('PRIVATE SQL and input'), { stage: 'publication', code: '57014' });
    const rejected = jest.fn().mockRejectedValue(error);
    const operations = {
      advisory_lock: () => f.withSessionAdvisoryLock.mockImplementation(rejected),
      state_read: () => f.repository.readState.mockImplementation(rejected),
      admission: () => f.withAdmission.mockImplementation(rejected),
      snapshot_read: () => f.repository.readSnapshot.mockImplementation(rejected),
      quality_collection: () => { f.repository.collectQuality = rejected; },
      evaluation: () => f.evaluate.mockImplementation(rejected),
      publication: () => f.repository.save.mockImplementation(rejected),
    };
    operations[stage]();
    const result = await f.worker.run();
    expect(result).toEqual({ status: 'failed', reason: 'evaluation_unavailable' });
    const taskError = createSourcePairTaskError(result);
    expect(readSourcePairTaskFailure(taskError)).toEqual({ failure: { stage } });
    expect(taskError).not.toHaveProperty('cause');
    expect(readSourcePairTaskFailure(createSourcePairTaskError({ ...result, stage }))).toBeNull();
  },
);

test('failure-recording error keeps the originating stage and five-minute local fallback', async () => {
  const f = fixture();
  const error = new Error('PRIVATE');
  f.repository.readSnapshot.mockRejectedValue(error);
  f.repository.fail.mockRejectedValue(error);
  const first = await f.worker.run();
  expect(readSourcePairTaskFailure(createSourcePairTaskError(first))).toEqual({
    failure: { stage: 'failure_record', originStage: 'snapshot_read' },
  });
  expect(f.repository.fail).toHaveBeenCalledWith('evaluation_unavailable', expect.any(AbortSignal));
  expect(await f.worker.run()).toEqual({ status: 'cooldown' });
});

test.each(['admission', 'advisory_lock'])('later %s rejection does not attribute failure to a successful publication', async stage => {
  const f = fixture();
  const error = new Error('PRIVATE');
  if (stage === 'admission') {
    f.withAdmission.mockImplementation(async (run, { signal }) => {
      await run(signal);
      throw error;
    });
  } else {
    f.withSessionAdvisoryLock.mockImplementation(async (_key, run) => {
      await run();
      throw error;
    });
  }
  const result = await f.worker.run();
  expect(f.repository.save).toHaveBeenCalledTimes(1);
  expect(readSourcePairTaskFailure(createSourcePairTaskError(result))).toEqual({ failure: { stage } });
  expect(f.repository.fail).toHaveBeenCalledTimes(stage === 'admission' ? 1 : 0);
});

test('checks actual publication entry if the admission signal is cancelled after evaluation', async () => {
  const f = fixture();
  const controller = new AbortController();
  f.withAdmission.mockImplementation((run, { signal }) => run(AbortSignal.any([signal, controller.signal])));
  f.evaluate.mockImplementation((...args) => {
    queueMicrotask(() => queueMicrotask(() => controller.abort(new Error('automatic_source_pair_deadline'))));
    return computeAutomaticSourcePair(...args);
  });
  expect(await f.worker.run()).toEqual({ status: 'failed', reason: 'deadline' });
  expect(f.repository.save).not.toHaveBeenCalled();
});

test('task error formats exactly one allowlisted reason observation', () => {
  const reason = jest.fn().mockReturnValueOnce('deadline').mockReturnValue('PRIVATE');
  expect(createSourcePairTaskError({ get reason() { return reason(); } }).message)
    .toBe('automatic_source_pair_evaluation_unavailable:deadline');
  expect(reason).toHaveBeenCalledTimes(1);
  expect(createSourcePairTaskError({ get reason() { throw new Error('PRIVATE'); } }).message)
    .toBe('automatic_source_pair_evaluation_unavailable:evaluation_unavailable');
});

test('worker shares lifecycle, admission and no process environment mutations', async () => {
  const f = fixture(), env = { ...process.env };
  const one = f.worker.run(); expect(f.worker.run()).toBe(one);
  expect(await one).toEqual({ status: 'evaluated' });
  expect(f.withSessionAdvisoryLock).toHaveBeenCalledWith(AUTOMATIC_SOURCE_PAIR_LOCK, expect.any(Function));
  expect(f.withAdmission).toHaveBeenCalledTimes(1); expect(f.repository.save).toHaveBeenCalledTimes(1);
  expect(process.env).toEqual(env);
  f.worker.stop(); expect(await f.worker.run()).toEqual({ status: 'stopped' });
});

test.each(['busy', 'memory_pressure', 'memory_unknown', 'disabled', 'unsupported_provider', 'representation_unavailable',
  'evidence_budget', 'deadline', 'private failure'])('failure %s persists fixed reason without source text', async code => {
  const f = fixture();
  const error = ['busy', 'memory_pressure', 'memory_unknown'].includes(code)
    ? Object.assign(new Error('inventory_discovery_deferred'), { reason: code })
    : new Error(code === 'deadline' ? 'automatic_source_pair_deadline' : code);
  if (code === 'evidence_budget') {
    f.repository.readSnapshot.mockImplementation(() => prepareInventoryDescriptionCorpus(Array(50001)));
  } else {
    f.repository.readSnapshot.mockRejectedValue(error);
  }
  const result = await f.worker.run();
  expect(result.status).toBe(['evidence_budget', 'deadline', 'private failure'].includes(code) ? 'failed' : 'deferred');
  expect(f.repository.fail).toHaveBeenCalledWith(code === 'private failure' ? 'evaluation_unavailable' : code, expect.any(AbortSignal));
  expect(f.repository.save).not.toHaveBeenCalled();
});

test.each([
  ['exact limit message', () => { throw new Error('inventory_description_corpus_limit_exceeded'); }],
  ['not a collection', () => prepareInventoryDescriptionCorpus(null)],
  ['missing configuration', () => readSourceDescriptionEvaluationSnapshot({ query: async () => ({ rows: [] }) }, sourcePairIdentity)],
  ['PostgreSQL text', () => { throw Object.assign(new Error('adjudication_capture_budget'), { code: '23514' }); }],
  ['invented deferral', () => { throw Object.assign(new Error('inventory_discovery_deferred'), { reason: 'evidence_budget' }); }],
  ['throwing reason', () => {
    throw Object.defineProperty(new Error('inventory_discovery_deferred'), 'reason', {
      get() { throw new Error('PRIVATE'); },
    });
  }],
])('stores a generic failure for %s', async (_name, reject) => {
  const f = fixture();
  f.repository.readSnapshot.mockImplementation(reject);
  expect(await f.worker.run()).toEqual({ status: 'failed', reason: 'evaluation_unavailable' });
  expect(f.repository.fail).toHaveBeenCalledWith('evaluation_unavailable', expect.any(AbortSignal));
  expect(f.repository.save).not.toHaveBeenCalled();
});
