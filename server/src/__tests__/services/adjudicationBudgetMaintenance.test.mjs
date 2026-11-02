/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { readAdjudicationBudget } from '../../services/adjudicationBudgetMaintenanceRepository.mjs';
import { LOCK_ADJUDICATION_MAINTENANCE_SQL, RESET_ADJUDICATION_DAY_SQL,
  PRUNE_ADJUDICATION_PROGRESS_SQL, READ_ADJUDICATION_BUDGET_SQL } from '../../services/adjudicationBudgetSql.mjs';
import { isAdjudicationAdvanceRefusal } from '../../services/adjudicationAdvanceRefusal.mjs';
import { isAdjudicationCheckpointRefusal } from '../../services/adjudicationCheckpointRefusal.mjs';
import { isAdjudicationReservationRefusal } from '../../services/adjudicationReservationRefusal.mjs';

const privateRefusal = error => [isAdjudicationAdvanceRefusal, isAdjudicationCheckpointRefusal,
  isAdjudicationReservationRefusal].some(check => check(error));
function fixture() {
  const state = { daily_calls: 0, status: 'disabled' };
  const query = jest.fn(async sql => sql === READ_ADJUDICATION_BUDGET_SQL ? { rows: [state] } : { rowCount: 1, rows: [] });
  const transaction = jest.fn(callback => callback({ query }));
  return { state, query, transaction, run: signal => readAdjudicationBudget(transaction, signal) };
}
test('claimless maintenance keeps its projection and dispatches time checks after serialization', async () => {
  const f = fixture(), stop = new AbortController();
  expect(await f.run(stop.signal)).toBe(f.state);
  expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), stop.signal);
  expect(f.query.mock.calls).toEqual([[LOCK_ADJUDICATION_MAINTENANCE_SQL], [RESET_ADJUDICATION_DAY_SQL],
    [PRUNE_ADJUDICATION_PROGRESS_SQL], [READ_ADJUDICATION_BUDGET_SQL]]);
});
test('exact absent-row zero is ordinary budget-changed, never owner refusal', async () => {
  const f = fixture(); f.query.mockResolvedValue({ rowCount: 0, rows: [] });
  const error = await f.run().catch(value => value);
  expect(error.message).toBe('adjudication_budget_changed'); expect(privateRefusal(error)).toBe(false);
  expect(f.query).toHaveBeenCalledTimes(1);
});
test.each([undefined, null, {}, { rowCount: null }, { rowCount: '0' }, { rowCount: '1' }, { rowCount: 2 }, { rowCount: -1 }])(
  'malformed maintenance lock result %j is an unknown contract failure', async result => {
    const f = fixture(); f.query.mockResolvedValue(result);
    const error = await f.run().catch(value => value);
    expect(error.message).toBe('adjudication_maintenance_result_invalid'); expect(privateRefusal(error)).toBe(false);
    expect(f.query).toHaveBeenCalledTimes(1);
  });
test('postlock stop prevents time-based commands', async () => {
  const f = fixture(), stop = new AbortController();
  f.query.mockImplementation(async () => { stop.abort(); return { rowCount: 1 }; });
  await expect(f.run(stop.signal)).rejects.toThrow(); expect(f.query).toHaveBeenCalledTimes(1);
});
test('existing reset/prune result handling and missing final row are preserved', async () => {
  const f = fixture(); f.query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce({ rowCount: null }).mockResolvedValue({ rows: [] });
  expect(await f.run()).toBeUndefined(); expect(f.query).toHaveBeenCalledTimes(4);
});
test('a query rejection propagates without private attribution or retry', async () => {
  const f = fixture(), failure = Object.assign(Error('Synthetic serialization refusal'), { code: '40001' });
  f.query.mockRejectedValue(failure);
  await expect(f.run()).rejects.toBe(failure); expect(privateRefusal(failure)).toBe(false);
  expect(f.query).toHaveBeenCalledTimes(1); expect(f.transaction).toHaveBeenCalledTimes(1);
});
