/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createAdjudicationBudgetFinalization } from '../../services/adjudicationBudgetFinalization.mjs';
import { createAdjudicationReservationRefusal } from '../../services/adjudicationReservationRefusal.mjs';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetWorkerFixture as fixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { isAdjudicationReservationRefusal } from '../../services/adjudicationReservationRefusal.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL, RESET_ADJUDICATION_RESERVATION_DAY_SQL, RESERVE_ADJUDICATION_SQL } from '../../services/adjudicationBudgetSql.mjs';

const attemptId = '41db1265-8bc1-4ab3-992f-885799a4af1d';
test('reservation uses only acknowledged private authority', async () => {
  const budget = { reserve: jest.fn() }, helper = createAdjudicationBudgetFinalization(budget);
  const signal = new AbortController().signal;
  await expect(helper.reserve(1, signal)).rejects.toThrow('claim_missing');
  expect(budget.reserve).not.toHaveBeenCalled();
  await helper.claim(1, async () => ({ revision: 1, attemptId }));
  await helper.reserve(1, signal);
  expect(budget.reserve).toHaveBeenCalledWith(1, signal, attemptId);
  await expect(helper.reserve(2, signal)).rejects.toThrow('claim_missing');
  expect(budget.reserve).toHaveBeenCalledTimes(1);
});

test('trusted refusal remains deferred through admission replacement and skips cleanup', async () => {
  const f = await fixture(); let clock = 100;
  f.budget.reserve.mockRejectedValue(createAdjudicationReservationRefusal());
  f.capture.mockImplementation(async (_options, { checkpoint, signal }) => { await checkpoint.reserve(signal); });
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, now: () => clock,
    withAdmission: async (callback, options) => {
      try { return await f.dependencies.withAdmission(callback, options); }
      catch { throw Error('PRIVATE admission replacement'); }
    } });
  try {
    expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(f.budget.reserve).toHaveBeenCalledTimes(1); expect(f.budget.finish).not.toHaveBeenCalled();
    clock = 300099; expect(await worker.run()).toEqual({ status: 'cooldown' });
    clock = 300100; expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(f.budget.reserve).toHaveBeenCalledTimes(2); expect(f.budget.finish).not.toHaveBeenCalled();
    const dependencies = f.capture.mock.calls[0][1];
    expect(dependencies).not.toHaveProperty('attemptId'); expect(JSON.stringify(dependencies)).not.toContain(attemptId);
  } finally { worker.stop(); }
});

test.each(['adjudication_reservation_not_owned', 'adjudication_budget_exhausted', 'PRIVATE lost COMMIT reply'])(
  'untrusted %s cannot mint an ownership refusal', async message => {
    const f = await fixture(); f.budget.reserve.mockRejectedValue(Error(message));
    f.capture.mockImplementation(async (_options, { checkpoint, signal }) => { await checkpoint.reserve(signal); });
    try {
      expect(await f.worker.run()).toEqual({ status: message === 'adjudication_budget_exhausted' ? 'budget_exhausted' : 'unavailable' });
      expect(f.budget.reserve).toHaveBeenCalledTimes(1); expect(f.budget.finish).toHaveBeenCalledTimes(1);
    } finally { f.worker.stop(); }
  });

test('stop keeps precedence over a trusted ownership refusal', async () => {
  const f = await fixture();
  f.budget.reserve.mockImplementation(async () => { f.worker.stop(); throw createAdjudicationReservationRefusal(); });
  f.capture.mockImplementation(async (_options, { checkpoint, signal }) => { await checkpoint.reserve(signal); });
  expect(await f.worker.run()).toEqual({ status: 'stopped' }); expect(f.budget.finish).not.toHaveBeenCalled();
});

test.each(['owner', 'reset', 'charge'].flatMap(phase => [undefined, null, '0', 2, -1].map(count => [phase,count])))(
  'invalid %s count %j is a failure, not proof of ownership loss or quota exhaustion', async (phase, count) => {
    const target = { owner: LOCK_OWNED_ADJUDICATION_BUDGET_SQL, reset: RESET_ADJUDICATION_RESERVATION_DAY_SQL, charge: RESERVE_ADJUDICATION_SQL }[phase];
    const query = jest.fn(async sql => ({ rowCount: sql === target ? count : 1 }));
    const budget = createAdjudicationBudgetRepository({ withTransaction: callback => callback({ query }) });
    const error = await budget.reserve(1, undefined, attemptId).catch(value => value);
    expect(error.message).toBe('adjudication_reservation_result_invalid'); expect(isAdjudicationReservationRefusal(error)).toBe(false);
    if (phase !== 'charge') expect(query.mock.calls.some(([sql]) => sql === RESERVE_ADJUDICATION_SQL)).toBe(false);
  });

test('refusal identity checks do not read hostile error properties', async () => {
  const touched = jest.fn(() => { throw Error('PRIVATE getter'); }), error = new Proxy({}, { get: touched });
  const helper = createAdjudicationBudgetFinalization({ reserve: async () => { throw error; } });
  await helper.claim(1, async () => ({ revision: 1, attemptId }));
  try { await helper.reserve(1); } catch (received) { expect(received).toBe(error); }
  expect(helper.notApplied).toBe(false); expect(touched).not.toHaveBeenCalled();
});
