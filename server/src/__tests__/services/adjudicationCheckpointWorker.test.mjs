/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetFinalization } from '../../services/adjudicationBudgetFinalization.mjs';
import { createAdjudicationCheckpointRefusal } from '../../services/adjudicationCheckpointRefusal.mjs';
import { createAdjudicationBudgetWorkerFixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';
import { fixtureAttemptId } from '../helpers/adjudicationFinalizationFixture.mjs';

test('checkpoint callbacks require acknowledged matching authority and keep its UUID private', async () => {
  const budget = { checkpoint: jest.fn(() => ({ open: jest.fn(), record: jest.fn(), publish: jest.fn() })) };
  const helper = createAdjudicationBudgetFinalization(budget);
  expect(() => helper.checkpoint(1)).toThrow('claim_missing');
  expect(budget.checkpoint).not.toHaveBeenCalled();
  await helper.claim(1, async () => ({ revision: 1, attemptId: fixtureAttemptId }));
  expect(() => helper.checkpoint(2)).toThrow('claim_missing');
  const checkpoint = helper.checkpoint(1);
  expect(Object.keys(checkpoint).sort()).toEqual(['open', 'publish', 'record']);
  expect(JSON.stringify(checkpoint)).not.toContain(fixtureAttemptId);
  expect(budget.checkpoint).toHaveBeenCalledTimes(1);
});

async function fixture(operation, error) {
  const f = await createAdjudicationBudgetWorkerFixture();
  const checkpoint = { open: jest.fn(), record: jest.fn(), publish: jest.fn() };
  checkpoint[operation].mockRejectedValue(error); f.budget.checkpoint.mockReturnValue(checkpoint);
  f.capture.mockImplementation(async (_input, dependencies) => {
    if (operation === 'publish') await dependencies.save(); else await dependencies.checkpoint[operation]();
  });
  return f;
}

test.each(['open', 'record', 'publish'])('trusted %s refusal survives admission replacement without cleanup or replay', async operation => {
  const f = await fixture(operation, createAdjudicationCheckpointRefusal()); let clock = 100;
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, now: () => clock,
    withAdmission: async (callback, options) => {
      try { return await f.dependencies.withAdmission(callback, options); }
      catch { throw Error('Synthetic replacement admission error'); }
    } });
  try {
    expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(f.budget.checkpoint).toHaveBeenCalledWith(1, fixtureAttemptId);
    expect(f.budget.finish).not.toHaveBeenCalled(); expect(f.capture).toHaveBeenCalledTimes(1);
    clock = 300099; expect(await worker.run()).toEqual({ status: 'cooldown' });
    expect(f.capture).toHaveBeenCalledTimes(1);
  } finally { worker.stop(); }
});

test.each(['open', 'record', 'publish'])('forged %s refusal text cannot erase existing failure cleanup authority', async operation => {
  const f = await fixture(operation, new Error('adjudication_checkpoint_not_owned'));
  try {
    expect(await f.worker.run()).toEqual({ status: 'unavailable' });
    expect(f.budget.finish).toHaveBeenCalledTimes(1);
    expect(f.budget.finish.mock.calls[0].slice(0, 2)).toEqual([1, 'unavailable']);
  } finally { f.worker.stop(); }
});

test.each(['open', 'record', 'publish'])('permanent stop takes precedence over %s ownership evidence', async operation => {
  const f = await fixture(operation, createAdjudicationCheckpointRefusal());
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission: async (callback, options) => {
    try { return await f.dependencies.withAdmission(callback, options); }
    catch { worker.stop(); throw Error('Synthetic replacement admission error'); }
  } });
  try {
    expect(await worker.run()).toEqual({ status: 'stopped' }); expect(f.budget.finish).not.toHaveBeenCalled();
  } finally { worker.stop(); }
});
