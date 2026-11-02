/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetFinalization } from '../../services/adjudicationBudgetFinalization.mjs';
import { createAdjudicationAdvanceRefusal } from '../../services/adjudicationAdvanceRefusal.mjs';
import { createAdjudicationBudgetWorkerFixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';
import { fixtureAttemptId } from '../helpers/adjudicationFinalizationFixture.mjs';

async function fixture(error) {
  const f = await createAdjudicationBudgetWorkerFixture();
  f.state.published_fingerprint = f.evaluation.input_fingerprint; f.budget.advance.mockRejectedValue(error);
  return f;
}
test('advance requires acknowledged matching authority and forwards no UUID in its result', async () => {
  const budget = { advance: jest.fn() }, helper = createAdjudicationBudgetFinalization(budget);
  await expect(helper.advance(1, 60)).rejects.toThrow('claim_missing'); expect(budget.advance).not.toHaveBeenCalled();
  await helper.claim(1, async () => ({ revision: 1, attemptId: fixtureAttemptId }));
  await expect(helper.advance(2, 60)).rejects.toThrow('claim_missing');
  expect(await helper.advance(1, 60)).toBeUndefined();
  expect(budget.advance).toHaveBeenCalledWith(1, 60, undefined, fixtureAttemptId);
});
test('trusted refusal survives admission replacement, prevents capture/cleanup and applies five-minute fallback', async () => {
  const f = await fixture(createAdjudicationAdvanceRefusal()); let clock = 100;
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, now: () => clock, withAdmission: async (callback, options) => {
    try { return await f.dependencies.withAdmission(callback, options); }
    catch { throw Error('Synthetic replacement admission error'); }
  } });
  try {
    expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(f.budget.advance).toHaveBeenCalledWith(1, f.evaluation.report.aiReplay.eligible, expect.any(AbortSignal), fixtureAttemptId);
    expect(f.capture).not.toHaveBeenCalled(); expect(f.budget.finish).not.toHaveBeenCalled();
    clock = 300099; expect(await worker.run()).toEqual({ status: 'cooldown' }); expect(f.budget.advance).toHaveBeenCalledTimes(1);
  } finally { worker.stop(); }
});
test.each(['adjudication_advance_not_owned', 'adjudication_advance_result_invalid', 'Synthetic unknown COMMIT']) (
  'untrusted %s retains failure cleanup authority without replay', async message => {
    const f = await fixture(new Error(message));
    try {
      expect(await f.worker.run()).toEqual({ status: 'unavailable' });
      expect(f.budget.finish).toHaveBeenCalledTimes(1); expect(f.budget.advance).toHaveBeenCalledTimes(1);
      expect(f.capture).not.toHaveBeenCalled();
    } finally { f.worker.stop(); }
  });
test('ordinary update zero keeps deferral and existing same-attempt cleanup', async () => {
  const f = await fixture(Error('adjudication_budget_changed'));
  try {
    expect(await f.worker.run()).toEqual({ status: 'deferred' }); expect(f.budget.finish).toHaveBeenCalledTimes(1);
    expect(f.budget.finish.mock.calls[0][1]).toBe('deferred');
  } finally { f.worker.stop(); }
});
test('permanent stop takes precedence over trusted advance refusal', async () => {
  const f = await fixture(createAdjudicationAdvanceRefusal());
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission: async (callback, options) => {
    try { return await f.dependencies.withAdmission(callback, options); }
    catch { worker.stop(); throw Error('Synthetic replacement admission error'); }
  } });
  try { expect(await worker.run()).toEqual({ status: 'stopped' }); expect(f.budget.finish).not.toHaveBeenCalled(); }
  finally { worker.stop(); }
});
