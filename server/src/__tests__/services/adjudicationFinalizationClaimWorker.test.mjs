/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetWorkerFixture as fixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';

const attemptId = '41db1265-8bc1-4ab3-992f-885799a4af1d';
test('missing owner capability cannot authorize evaluation or failure finish', async () => {
  const f = await fixture();
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission: (callback, { signal }) => callback(signal) });
  try {
    expect(await worker.run()).toEqual({ status: 'unavailable' });
    expect(f.repository.readState).not.toHaveBeenCalled(); expect(f.budget.finish).not.toHaveBeenCalled();
  } finally { worker.stop(); }
});

test.each(['zero', 'rejected', 'invalid'])('a %s claim confers no finish or provider authority', async mode => {
  const f = await fixture(), claim = jest.fn(async () => {
    if (mode === 'rejected') throw Error('PRIVATE uncertain claim');
    return mode === 'zero' ? null : { revision: 1, attemptId: 'invalid' };
  });
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies,
    withAdmission: (callback, { signal }) => callback(signal, undefined, { claimFinalization: claim }) });
  try {
    expect(await worker.run()).toEqual({ status: mode === 'zero' ? 'deferred' : 'unavailable' });
    expect(claim).toHaveBeenCalledTimes(1); expect(f.repository.readState).not.toHaveBeenCalled();
    expect(f.budget.finish).not.toHaveBeenCalled(); expect(f.capture).not.toHaveBeenCalled();
    expect(await worker.run()).toEqual({ status: 'cooldown' });
  } finally { worker.stop(); }
});

test('only the acknowledged owner token reaches primary and same-attempt cleanup finishes', async () => {
  const f = await fixture(), claim = jest.fn(async () => ({ revision: 1, attemptId }));
  f.budget.finish.mockRejectedValueOnce(Error('PRIVATE lost finish acknowledgement'));
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies,
    withAdmission: (callback, { signal }) => callback(signal, undefined, { claimFinalization: claim }) });
  try {
    expect(await worker.run()).toEqual({ status: 'unavailable' }); expect(claim).toHaveBeenCalledTimes(1);
    expect(f.budget.finish).toHaveBeenCalledTimes(2);
    for (const call of f.budget.finish.mock.calls) expect(call[4]).toBe(attemptId);
    const dependencies = f.capture.mock.calls[0][1];
    expect(dependencies).not.toHaveProperty('claimFinalization'); expect(JSON.stringify(dependencies)).not.toContain(attemptId);
  } finally { worker.stop(); }
});
