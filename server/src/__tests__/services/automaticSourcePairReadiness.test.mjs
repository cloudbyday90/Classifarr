/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';

const evaluator = { run: jest.fn(), stop: jest.fn() }, capture = { run: jest.fn(), stop: jest.fn() };
jest.unstable_mockModule('../../services/automaticSourcePairEvaluation.mjs', () => ({ createAutomaticSourcePairEvaluation: () => evaluator }));
jest.unstable_mockModule('../../services/adjudicationBudgetWorker.mjs', () => ({ createAdjudicationBudgetWorker: () => capture }));
const { createAutomaticSourcePairWorkers } = await import('../../services/automaticSourcePairWorkers.mjs');
const { withBoundedInventoryReadiness } = await import('../../services/boundedInventoryReadinessGuard.mjs');
const { READINESS_SCOPES } = await import('../../utils/databaseReadinessAdmission.mjs');

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
afterEach(() => { jest.useRealTimers(); jest.resetAllMocks(); });
function setup(query = jest.fn(async () => ({ rows: [{ readiness: 'ready' }] }))) {
  const db = { query: jest.fn(), withTransaction: jest.fn(fn => fn({ query })), withSessionAdvisoryLock: jest.fn() };
  return { db, query, runtime: createAutomaticSourcePairWorkers(db) };
}

test('the existing composite awaits evaluator then independent capture and returns only the evaluator result', async () => {
  jest.useFakeTimers();
  const evaluation = deferred(), generation = deferred(), owner = new AbortController();
  const result = { status: 'deferred', reason: 'unchanged_evaluation_reason' };
  evaluator.run.mockReturnValue(evaluation.promise); capture.run.mockReturnValue(generation.promise);
  const { runtime, db } = setup(), pending = runtime.run({ signal: owner.signal });
  await jest.advanceTimersByTimeAsync(0);
  expect(evaluator.run).toHaveBeenCalledWith(); expect(capture.run).not.toHaveBeenCalled();
  const probe = db.withTransaction.mock.calls[0][1];
  expect(probe).toMatchObject({ readOnly: true, timeoutMs: 3000, readinessScope: READINESS_SCOPES.SOURCE_PAIR });
  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(5000); expect(probe.signal.aborted).toBe(false);
  // Caller cancellation owns preflight only; it cannot permanently stop either child.
  owner.abort('PRIVATE caller'); evaluation.resolve(result);
  await jest.advanceTimersByTimeAsync(0);
  expect(capture.run).toHaveBeenCalledWith();
  expect(evaluator.stop).not.toHaveBeenCalled(); expect(capture.stop).not.toHaveBeenCalled();
  generation.resolve({ status: 'disabled' }); expect(await pending).toBe(result);
  runtime.stop(); expect(evaluator.stop).toHaveBeenCalledTimes(1); expect(capture.stop).toHaveBeenCalledTimes(1);
  expect(await runtime.run()).toEqual({ status: 'stopped' });
});

test('source-pair first-owner coalescing rejects pre-aborted joiners without replacing the owner', async () => {
  const ready = deferred(), owner = new AbortController(), joiner = new AbortController();
  const { runtime, db } = setup(jest.fn(() => ready.promise));
  evaluator.run.mockResolvedValue({ status: 'complete' }); capture.run.mockResolvedValue({ status: 'disabled' });
  const pending = runtime.run({ signal: owner.signal });
  expect(runtime.run({ signal: joiner.signal })).toBe(pending);
  joiner.abort(); expect(await runtime.run({ signal: joiner.signal })).toEqual({ status: 'cancelled' });
  expect(db.withTransaction.mock.calls[0][1].signal.aborted).toBe(false);
  ready.resolve({ rows: [{ readiness: 'ready' }] }); expect(await pending).toEqual({ status: 'complete' });
  expect(evaluator.run).toHaveBeenCalledTimes(1); expect(capture.run).toHaveBeenCalledTimes(1); runtime.stop();
});

test.each(['late_ready', 'late_error'])('source-pair exact deadline fences %s and a later tick runs fresh', async kind => {
  jest.useFakeTimers();
  const ready = deferred(), query = jest.fn(() => ready.promise), { runtime } = setup(query);
  const pending = runtime.run();
  await jest.advanceTimersByTimeAsync(2999); expect(evaluator.run).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  if (kind === 'late_ready') ready.resolve({ rows: [{ readiness: 'ready' }] });
  else ready.reject(Object.assign(Error('PRIVATE database'), { code: '53100' }));
  expect(await pending).toEqual({ status: 'deferred', reason: 'unavailable' });
  expect(evaluator.run).not.toHaveBeenCalled(); expect(capture.run).not.toHaveBeenCalled();
  query.mockResolvedValueOnce({ rows: [{ readiness: 'disabled' }] });
  expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'disabled' });
  runtime.stop(); expect(jest.getTimerCount()).toBe(0);
});

test.each([{}, { rows: [{}] }])('missing readiness remains unavailable and cannot invoke either child: %j', async reply => {
  const { runtime } = setup(jest.fn(async () => reply));
  expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'unavailable' });
  expect(evaluator.run).not.toHaveBeenCalled(); expect(capture.run).not.toHaveBeenCalled(); runtime.stop();
});

test('a genuine query failure stays quiet and owner abort permits only a fresh future probe', async () => {
  const failed = setup(jest.fn(async () => { throw Object.assign(Error('PRIVATE SQL'), { code: '53100' }); }));
  expect(await failed.runtime.run()).toEqual({ status: 'deferred', reason: 'unavailable' }); failed.runtime.stop();
  const owner = new AbortController(), ready = deferred(), { runtime, query } = setup(jest.fn(() => ready.promise));
  const pending = runtime.run({ signal: owner.signal }); owner.abort('PRIVATE owner');
  ready.resolve({ rows: [{ readiness: 'ready' }] }); expect(await pending).toEqual({ status: 'cancelled' });
  expect(evaluator.run).not.toHaveBeenCalled(); expect(capture.run).not.toHaveBeenCalled();
  query.mockResolvedValueOnce({ rows: [{ readiness: 'waiting_for_inventory' }] });
  expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'waiting_for_inventory' }); runtime.stop();
});

test('a failing domain diagnosis cannot admit work and unknown core scopes are rejected', async () => {
  const worker = { run: jest.fn(), stop: jest.fn() };
  expect(() => withBoundedInventoryReadiness(worker, {}, 'unknown')).toThrow('scope_invalid');
  const runtime = withBoundedInventoryReadiness(worker, {}, READINESS_SCOPES.SOURCE_PAIR, {
    read: async () => { throw Error('PRIVATE query'); }, diagnoseFailure: () => { throw Error('PRIVATE diagnosis'); },
  });
  expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'unavailable' });
  expect(worker.run).not.toHaveBeenCalled(); runtime.stop();
});
