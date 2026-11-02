/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetWorkerFixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';

test.each(['outer', 'admitted'].flatMap(stage => [
  ['adjudication_budget_changed', 'deferred'], ['adjudication_maintenance_result_invalid', 'unavailable'], ['Synthetic unknown COMMIT', 'unavailable'],
].map(([message, status]) => ({ stage, message, status }))))(
  '$stage maintenance failure $message preserves $status without claim, provider permission or durable cleanup', async ({ stage, message, status }) => {
    const f = await createAdjudicationBudgetWorkerFixture(), claim = jest.fn(); let clock = 100;
    if (stage === 'admitted') f.budget.read.mockResolvedValueOnce(f.state).mockRejectedValueOnce(Error(message));
    else f.budget.read.mockRejectedValueOnce(Error(message));
    const admission = jest.fn((callback, { signal }) => callback(signal, undefined, { claimFinalization: claim }));
    const workload = jest.fn(f.dependencies.withWorkload);
    const worker = createAdjudicationBudgetWorker({ ...f.dependencies, now: () => clock, withAdmission: admission, withWorkload: workload });
    try {
      expect(await worker.run()).toEqual({ status }); expect(claim).not.toHaveBeenCalled();
      expect(f.capture).not.toHaveBeenCalled(); expect(workload).not.toHaveBeenCalled(); expect(f.budget.finish).not.toHaveBeenCalled();
      expect(admission).toHaveBeenCalledTimes(stage === 'outer' ? 0 : 1);
      const reads = f.budget.read.mock.calls.length; clock = 300099;
      expect(await worker.run()).toEqual({ status: 'cooldown' }); expect(f.budget.read).toHaveBeenCalledTimes(reads);
    } finally { worker.stop(); }
  });
test('permanent stop during a maintenance failure keeps lifecycle precedence', async () => {
  const f = await createAdjudicationBudgetWorkerFixture();
  const worker = createAdjudicationBudgetWorker(f.dependencies);
  f.budget.read.mockImplementationOnce(async () => { worker.stop(); throw Error('adjudication_budget_changed'); });
  expect(await worker.run()).toEqual({ status: 'stopped' });
  expect(f.budget.finish).not.toHaveBeenCalled(); expect(f.capture).not.toHaveBeenCalled();
});
