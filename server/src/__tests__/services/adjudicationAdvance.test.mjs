/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { advanceAdjudicationBudget } from '../../services/adjudicationAdvanceRepository.mjs';
import { isAdjudicationAdvanceRefusal } from '../../services/adjudicationAdvanceRefusal.mjs';
import { fixtureAttemptId } from '../helpers/adjudicationFinalizationFixture.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL, ADVANCE_ADJUDICATION_BUDGET_SQL } from '../../services/adjudicationBudgetSql.mjs';

function fixture() {
  const query = jest.fn(async () => ({ rowCount: 1, rows: [] }));
  const transaction = jest.fn(callback => callback({ query }));
  return { query, transaction, run: (eligible = 60, signal) => advanceAdjudicationBudget(transaction, 1, eligible, signal, fixtureAttemptId) };
}
test('missing authority starts no transaction', () => {
  const transaction = jest.fn();
  for (const id of [undefined, null, '', 'invalid']) expect(() => advanceAdjudicationBudget(transaction, 1, 60, undefined, id)).toThrow('claim_invalid');
  expect(transaction).not.toHaveBeenCalled();
});
test.each([-1, 301, 1.5, NaN, '25'])('invalid eligible count %j performs no checkpoint SQL', async eligible => {
  const f = fixture(); await expect(f.run(eligible)).rejects.toThrow('rotation_invalid'); expect(f.query).not.toHaveBeenCalled();
});
test('only exact owner zero creates private refusal before advance', async () => {
  const f = fixture(); f.query.mockResolvedValue({ rowCount: 0, rows: [] });
  const error = await f.run().catch(value => value);
  expect(isAdjudicationAdvanceRefusal(error)).toBe(true);
  expect(f.query.mock.calls).toEqual([[LOCK_OWNED_ADJUDICATION_BUDGET_SQL, [1, fixtureAttemptId]]]);
});
const malformed = [undefined, null, {}, { rowCount: null }, { rowCount: '0' }, { rowCount: '1' }, { rowCount: 2 }, { rowCount: -1 }];
test.each(malformed)('malformed owner result %j stays an unknown contract failure', async result => {
  const f = fixture(); f.query.mockResolvedValue(result);
  const error = await f.run().catch(value => value);
  expect(error.message).toBe('adjudication_advance_result_invalid'); expect(isAdjudicationAdvanceRefusal(error)).toBe(false);
});
test.each(malformed)('malformed update result %j is not ordinary zero or ownership proof', async result => {
  const f = fixture(); f.query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValue(result);
  const error = await f.run().catch(value => value);
  expect(error.message).toBe('adjudication_advance_result_invalid'); expect(isAdjudicationAdvanceRefusal(error)).toBe(false);
});
test('ordinary update zero stays budget-changed', async () => {
  const f = fixture(); f.query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValue({ rowCount: 0 });
  const error = await f.run().catch(value => value);
  expect(error.message).toBe('adjudication_budget_changed'); expect(isAdjudicationAdvanceRefusal(error)).toBe(false);
});
test('stop after the prelock prevents advance', async () => {
  const f = fixture(), stop = new AbortController();
  f.query.mockImplementation(async () => { stop.abort(); return { rowCount: 1 }; });
  await expect(f.run(60, stop.signal)).rejects.toThrow(); expect(f.query).toHaveBeenCalledTimes(1);
});
test('successful empty DML rows bind the private UUID without returning authority', async () => {
  const f = fixture(); expect(await f.run()).toBeUndefined();
  expect(f.query.mock.calls).toEqual([[LOCK_OWNED_ADJUDICATION_BUDGET_SQL, [1, fixtureAttemptId]],
    [ADVANCE_ADJUDICATION_BUDGET_SQL, [1, 60, fixtureAttemptId]]]);
});
