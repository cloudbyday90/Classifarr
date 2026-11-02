/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetWorkerFixture as fixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';

test.each(['deferred', 'waiting_for_replay', 'budget_exhausted', 'captured'])(
  'acknowledged zero at primary %s defers once with a local cooldown', async primary => {
    const f = await fixture(); let clock = 100;
    if (primary === 'deferred') f.repository.readState.mockResolvedValue(null);
    if (primary === 'waiting_for_replay') {
      f.state.published_fingerprint = f.prepared.fingerprint; f.evaluation.input_fingerprint = 'e'.repeat(64);
    }
    if (primary === 'budget_exhausted') f.state.tokens_reserved = f.state.daily_tokens;
    f.budget.finish.mockResolvedValue({ rowCount: 0 });
    const worker = createAdjudicationBudgetWorker({ ...f.dependencies, now: () => clock });
    try {
      const first = worker.run(); expect(worker.run()).toBe(first);
      expect(await first).toEqual({ status: 'deferred' });
      expect(f.budget.finish).toHaveBeenCalledTimes(1);
      expect(f.budget.finish.mock.calls[0].slice(0, 2)).toEqual([1, primary]);
      expect(f.capture).toHaveBeenCalledTimes(primary === 'captured' ? 1 : 0);
      clock = 300099; expect(await worker.run()).toEqual({ status: 'cooldown' });
      expect(f.budget.finish).toHaveBeenCalledTimes(1);
      f.budget.finish.mockResolvedValue({ rowCount: 1 }); clock = 300100;
      expect((await worker.run()).status).toBe(primary);
      expect(f.budget.finish).toHaveBeenCalledTimes(2); // The new flight has no retained zero-row flag.
    } finally { worker.stop(); }
  });

test('a replaced admission error cannot erase acknowledged zero or add a cleanup finish', async () => {
  const f = await fixture(); f.budget.finish.mockResolvedValue({ rowCount: 0 });
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission: async (callback, { signal }) => {
    try { return await f.dependencies.withAdmission(callback, { signal }); }
    catch { throw Error('PRIVATE replacement admission failure'); }
  } });
  try {
    expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(f.budget.finish).toHaveBeenCalledTimes(1);
  } finally { worker.stop(); }
});

test.each([
  ['PRIVATE provider failure', 'unavailable'], ['adjudication_budget_exhausted', 'budget_exhausted'],
  ['evaluation_workload_deferred', 'deferred'],
])('cleanup zero preserves the observed %s outcome as %s', async (message, status) => {
  const f = await fixture(); f.capture.mockRejectedValue(Error(message)); f.budget.finish.mockResolvedValue({ rowCount: 0 });
  try {
    expect(await f.worker.run()).toEqual({ status });
    expect(f.budget.finish).toHaveBeenCalledTimes(1);
    expect(await f.worker.run()).toEqual({ status: 'cooldown' });
  } finally { f.worker.stop(); }
});

test.each([undefined, null, {}, { rowCount: null }, { rowCount: '0' }, { rowCount: 2 }, { rowCount: -1 }])(
  'invalid result %j is a contract failure, not acknowledged zero', async result => {
    const f = await fixture(); f.budget.finish.mockResolvedValue(result);
    try {
      expect(await f.worker.run()).toEqual({ status: 'unavailable' });
      expect(f.budget.finish).toHaveBeenCalledTimes(2); // Existing primary-error cleanup, without an inferred zero.
    } finally { f.worker.stop(); }
  });

test('a rejected finish with the internal error text is not acknowledged zero', async () => {
  const f = await fixture(); f.budget.finish.mockRejectedValue(Error('adjudication_finalization_not_applied'));
  try {
    expect(await f.worker.run()).toEqual({ status: 'unavailable' });
    expect(f.budget.finish).toHaveBeenCalledTimes(2);
  } finally { f.worker.stop(); }
});

test('permanent stop overrides acknowledged zero even when admission replaces its error', async () => {
  const f = await fixture(); f.budget.finish.mockResolvedValue({ rowCount: 0 });
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission: async (callback, { signal }) => {
    try { return await f.dependencies.withAdmission(callback, { signal }); }
    catch { worker.stop(); throw Error('PRIVATE replacement admission failure'); }
  } });
  try {
    expect(await worker.run()).toEqual({ status: 'stopped' }); expect(f.budget.finish).toHaveBeenCalledTimes(1);
    expect(await worker.run()).toEqual({ status: 'stopped' });
  } finally { worker.stop(); }
});
