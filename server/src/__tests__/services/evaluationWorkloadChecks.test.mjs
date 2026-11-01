/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { performance } from 'node:perf_hooks';
import { createEvaluationWorkloadChecks } from '../../services/evaluationWorkloadChecks.mjs';
import { createEvaluationWorkloadGuard } from '../../services/evaluationWorkloadGuard.mjs';
import { readEvaluationWorkloadCheck } from '../../services/evaluationWorkloadCheckReader.mjs';
import { READINESS_SCOPES } from '../../utils/databaseReadinessAdmission.mjs';
import { READ_ADJUDICATION_BUDGET_SQL } from '../../services/adjudicationBudgetSql.mjs';
import { INVENTORY_BACKGROUND_READINESS_SQL } from '../../services/inventoryBackgroundReadiness.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const state = () => ({ daily_calls: 5, revision: 1, window_open: true });
const options = () => ({ revision: 1, signal: new AbortController().signal });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test.each([undefined, { daily_calls: 0 }, { ...state(), revision: 2 }, { ...state(), window_open: null }])(
  'budget refusal %j short-circuits readiness and never inserts or updates', async row => {
    const query = jest.fn(async () => ({ rows: row ? [row] : [] }));
    const database = { withTransaction: jest.fn(fn => fn({ query })) };
    expect(await readEvaluationWorkloadCheck(database, { ...options(), scope: READINESS_SCOPES.WORKLOAD_MONITOR,
      deadline: performance.now() + 3000 })).toBe(false);
    expect(query.mock.calls).toEqual([[READ_ADJUDICATION_BUDGET_SQL]]);
    expect(database.withTransaction.mock.calls[0][1]).toMatchObject({ readOnly: true,
      readinessScope: READINESS_SCOPES.WORKLOAD_MONITOR });
  },
);

test('separate transactions share remaining time rather than installing two full budgets', async () => {
  let clock = 0; jest.spyOn(performance, 'now').mockImplementation(() => clock);
  const query = jest.fn(async sql => {
    if (sql === READ_ADJUDICATION_BUDGET_SQL) { clock = 2900; return { rows: [state()] }; }
    return { rows: [{ readiness: 'ready' }] };
  });
  const database = { withTransaction: jest.fn(fn => fn({ query })) };
  expect(await readEvaluationWorkloadCheck(database, { ...options(), scope: READINESS_SCOPES.WORKLOAD_RESERVATION, deadline: 3000 })).toBe(true);
  expect(query.mock.calls).toEqual([[READ_ADJUDICATION_BUDGET_SQL], [INVENTORY_BACKGROUND_READINESS_SQL]]);
  expect(database.withTransaction.mock.calls.map(call => call[1].timeoutMs)).toEqual([3000, 100]);
});

test.each(['before', 'after_budget', 'after_readiness'])('expired %s check cannot admit work or start another read', async when => {
  let clock = when === 'before' ? 3000 : 0; jest.spyOn(performance, 'now').mockImplementation(() => clock);
  const query = jest.fn(async sql => {
    if (when === 'after_budget' || sql === INVENTORY_BACKGROUND_READINESS_SQL) clock = 3000;
    return { rows: [sql === READ_ADJUDICATION_BUDGET_SQL ? state() : { readiness: 'ready' }] };
  });
  const database = { withTransaction: fn => fn({ query }) };
  await expect(readEvaluationWorkloadCheck(database, { ...options(), scope: READINESS_SCOPES.WORKLOAD_MONITOR, deadline: 3000 })).rejects.toThrow('evaluation_workload_deferred');
  expect(query).toHaveBeenCalledTimes(when === 'before' ? 0 : when === 'after_budget' ? 1 : 2);
});

test('pre-abort retains the parent reason and opens no check', async () => {
  const root = new AbortController(), reason = Error('parent stopped'); root.abort(reason);
  const read = jest.fn(), checks = createEvaluationWorkloadChecks({}, { revision: 1, signal: root.signal, read });
  await expect(checks.monitor()).rejects.toBe(reason); await checks.close();
  expect(read).not.toHaveBeenCalled(); expect(checks.signal.reason).toBe(reason);
});

test('the exact three-second deadline aborts the invocation and clears every check timer', async () => {
  jest.useFakeTimers();
  const read = jest.fn((_db, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(Error('PRIVATE query')), { once: true });
  }));
  const checks = createEvaluationWorkloadChecks({}, { ...options(), read });
  const pending = expect(checks.monitor()).rejects.toThrow('evaluation_workload_deferred');
  await jest.advanceTimersByTimeAsync(2999); expect(checks.signal.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1); await pending;
  expect(checks.signal.aborted).toBe(true); await checks.close(); expect(jest.getTimerCount()).toBe(0);
});

test('reservation checks never reuse monitor success and unexpected same-role overlap fails closed', async () => {
  const monitor = deferred(), reservation = deferred();
  const read = jest.fn((_db, { scope }) => scope === READINESS_SCOPES.WORKLOAD_MONITOR ? monitor.promise : reservation.promise);
  const checks = createEvaluationWorkloadChecks({}, { ...options(), read });
  const first = checks.monitor(), fresh = checks.reservation();
  monitor.resolve(true); await first;
  expect(read.mock.calls.map(call => call[1].scope)).toEqual([READINESS_SCOPES.WORKLOAD_MONITOR, READINESS_SCOPES.WORKLOAD_RESERVATION]);
  const rejected = expect(fresh).rejects.toThrow('evaluation_workload_deferred');
  await expect(checks.reservation()).rejects.toThrow('evaluation_workload_deferred');
  expect(read).toHaveBeenCalledTimes(2);
  reservation.resolve(true); await rejected; await checks.close();
});

test('a fresh reservation refusal after a successful monitor still cancels the invocation', async () => {
  const read = jest.fn(async (_db, { scope }) => scope === READINESS_SCOPES.WORKLOAD_MONITOR);
  const checks = createEvaluationWorkloadChecks({}, { ...options(), read });
  await checks.monitor();
  await expect(checks.reservation()).rejects.toThrow('evaluation_workload_deferred');
  expect(checks.signal.aborted).toBe(true); await checks.close();
});

test.each(['success', 'failure'])('callback %s closes and concurrently drains both roles without replacing its result', async outcome => {
  jest.useFakeTimers();
  const finish = deferred(), cleanups = [deferred(), deferred()], primary = Error('primary provider failure');
  let calls = 0, aborted = 0, escaped, fresh;
  const readCheck = jest.fn((_db, { signal }) => {
    if (++calls === 1) return true;
    const cleanup = cleanups[calls - 2];
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () => { aborted++; cleanup.promise.then(() => reject(Error('PRIVATE cleanup'))); }, { once: true });
    });
  });
  const guard = createEvaluationWorkloadGuard({}, { readCheck });
  let settled = false;
  const execution = guard(async (_signal, check) => {
    escaped = check;
    await finish.promise;
    if (outcome === 'failure') throw primary;
    return 7;
  }, options());
  const result = execution.then(value => ({ value }), error => ({ error })).finally(() => { settled = true; });
  await jest.advanceTimersByTimeAsync(2000);
  fresh = escaped().catch(error => error);
  finish.resolve(); await jest.advanceTimersByTimeAsync(0);
  expect(aborted).toBe(2); expect(settled).toBe(false);
  cleanups[0].resolve(); await jest.advanceTimersByTimeAsync(0); expect(settled).toBe(false);
  cleanups[1].resolve();
  expect(await result).toEqual(outcome === 'success' ? { value: 7 } : { error: primary });
  expect((await fresh).message).toBe('evaluation_workload_deferred');
  await expect(escaped()).rejects.toThrow('evaluation_workload_deferred');
  await jest.advanceTimersByTimeAsync(10000);
  expect(readCheck).toHaveBeenCalledTimes(3); expect(jest.getTimerCount()).toBe(0);
});
