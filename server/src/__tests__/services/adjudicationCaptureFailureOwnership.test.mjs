/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetWorkerFixture as fixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

test('failure finish remains owned until settlement and its callback still rejects', async () => {
  const f = await fixture(), started = deferred(), release = deferred();
  let admitted = false, ownedAtFinish, callbackFailed = false, execution;
  f.capture.mockRejectedValue(Error('PRIVATE provider failure'));
  f.budget.finish.mockImplementation(async () => { ownedAtFinish = admitted; started.resolve(); await release.promise; return { rowCount: 1 }; });
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission: async (callback, { signal }) => {
    admitted = true;
    try { return await callback(signal); }
    catch (error) { callbackFailed = true; throw error; }
    finally { admitted = false; }
  } });
  try {
    execution = worker.run(); await started.promise;
    expect(ownedAtFinish).toBe(true); expect(admitted).toBe(true);
    release.resolve(); expect(await execution).toEqual({ status: 'unavailable' });
    expect(callbackFailed).toBe(true); expect(admitted).toBe(false); expect(f.budget.finish).toHaveBeenCalledTimes(1);
  } finally { worker.stop(); release.resolve(); await execution; }
});

test.each([['inventory_discovery_deferred', 'deferred'], ['PRIVATE admission failure', 'unavailable']])(
  'pre-admission %s remains %s with local cooldown only', async (message, status) => {
    const f = await fixture(); let clock = 100;
    const worker = createAdjudicationBudgetWorker({ ...f.dependencies, now: () => clock,
      withAdmission: async () => { throw Error(message); } });
    try {
      expect(await worker.run()).toEqual({ status }); expect(f.budget.finish).not.toHaveBeenCalled();
      clock = 300099; expect(await worker.run()).toEqual({ status: 'cooldown' });
      clock = 300100; expect(await worker.run()).toEqual({ status });
      expect(f.budget.finish).not.toHaveBeenCalled(); expect(f.capture).not.toHaveBeenCalled();
    } finally { worker.stop(); }
  });

test.each([['inventory_discovery_deferred', 'deferred'], ['PRIVATE unlock failure', 'unavailable']])(
  'post-callback %s preserves saved capture and reports %s locally', async (message, status) => {
    const f = await fixture();
    const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission: async (callback, { signal }) => {
      await callback(signal); throw Error(message);
    } });
    try {
      expect(await worker.run()).toEqual({ status });
      expect(f.budget.finish).toHaveBeenCalledTimes(1); expect(f.budget.finish.mock.calls[0][1]).toBe('captured');
      expect(await worker.run()).toEqual({ status: 'cooldown' });
    } finally { worker.stop(); }
  });

test('an admission reason already aborted at failure entry retains precedence', async () => {
  const f = await fixture(), admission = new AbortController();
  f.capture.mockImplementation(async () => { admission.abort(Error('inventory_discovery_deferred')); throw Error('PRIVATE provider failure'); });
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission: async callback => {
    try { return await callback(admission.signal); }
    catch (error) { admission.signal.throwIfAborted(); throw error; }
  } });
  try {
    expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(f.budget.finish).toHaveBeenCalledTimes(1); expect(f.budget.finish.mock.calls[0][1]).toBe('deferred');
  } finally { worker.stop(); }
});

test.each(['zero', 'rejection'])(
  'cleanup %s and late admission abort preserve the first outcome and exact fallback deadline', async cleanup => {
    const f = await fixture(), admission = new AbortController(); let clock = 100;
    f.capture.mockRejectedValue(Error('PRIVATE provider failure'));
    f.budget.finish.mockImplementation(async () => {
      clock = 10000; admission.abort(Error('inventory_discovery_deferred'));
      if (cleanup === 'rejection') throw Error('PRIVATE cleanup failure');
      return { rowCount: 0 };
    });
    const worker = createAdjudicationBudgetWorker({ ...f.dependencies, now: () => clock, withAdmission: async callback => {
      try { return await callback(admission.signal); }
      catch (error) { admission.signal.throwIfAborted(); throw error; }
    } });
    try {
      expect(await worker.run()).toEqual({ status: 'unavailable' }); expect(f.budget.finish).toHaveBeenCalledTimes(1);
      clock = 300099; expect(await worker.run()).toEqual({ status: 'cooldown' });
      clock = 300100; f.capture.mockResolvedValue({ calls: 0, reused: 0, stored: 0 });
      expect((await worker.run()).status).toBe('captured'); // The late abort did not extend retryAfter.
    } finally { worker.stop(); }
  });

test('a later boundary error cannot replace an admitted budget failure or add another finish', async () => {
  const f = await fixture(); f.capture.mockRejectedValue(Error('adjudication_budget_exhausted'));
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission: async (callback, { signal }) => {
    try { return await callback(signal); }
    catch { throw Error('PRIVATE later boundary failure'); }
  } });
  try {
    expect(await worker.run()).toEqual({ status: 'budget_exhausted' });
    expect(f.budget.finish).toHaveBeenCalledTimes(1); expect(f.budget.finish.mock.calls[0][1]).toBe('budget_exhausted');
  } finally { worker.stop(); }
});
