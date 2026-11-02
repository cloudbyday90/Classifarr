/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createAdjudicationFinalizationClaim } from '../../services/adjudicationFinalizationClaim.mjs';
import { createAdjudicationBudgetFinalization } from '../../services/adjudicationBudgetFinalization.mjs';

const attemptId = '41db1265-8bc1-4ab3-992f-885799a4af1d';
const accepted = () => ({ rowCount: 1, rows: [{ revision: 1, finalization_attempt_id: attemptId }] });
const fixture = result => {
  const controller = new AbortController();
  const query = jest.fn(async sql => sql.startsWith('UPDATE') ? result : { rowCount: null, rows: [] });
  return { controller, query, operation: createAdjudicationFinalizationClaim({ query, signal: controller.signal }) };
};

test('one use is latched before acquisition/SQL settles', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture(accepted()); f.query.mockImplementationOnce(() => pending);
  const execution = f.operation(1);
  await expect(f.operation(1)).rejects.toThrow('already_attempted');
  release(); expect(await execution).toEqual({ revision: 1, attemptId });
  expect(f.query.mock.calls.filter(([sql]) => sql === 'BEGIN')).toHaveLength(1);
});

test.each([undefined, { rowCount: '0', rows: [] }, { rowCount: 0, rows: [{}] },
  { rowCount: 1, rows: [{ revision: 2, finalization_attempt_id: attemptId }] },
  { rowCount: 1, rows: [{ revision: 1, finalization_attempt_id: 'invalid' }] }])(
  'invalid acknowledgement %j rolls back and cannot be repeated', async result => {
    const f = fixture(result);
    await expect(f.operation(1)).rejects.toThrow();
    expect(f.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(f.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    await expect(f.operation(1)).rejects.toThrow('already_attempted');
  });

test.each(['before', 'after'])('stop %s COMMIT confers no local claim authority', async phase => {
  const f = fixture(accepted()), native = f.query.getMockImplementation();
  f.query.mockImplementation(async (...args) => {
    const result = await native(...args);
    if (args[0] === (phase === 'before' ? "SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='1s'" : 'COMMIT')) f.controller.abort();
    return result;
  });
  await expect(f.operation(1)).rejects.toThrow();
  expect(f.query).toHaveBeenLastCalledWith('ROLLBACK');
  expect(f.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(phase === 'after');
});

test('lost COMMIT and failed rollback do not authorize a finish or another claim', async () => {
  const f = fixture(accepted()), native = f.query.getMockImplementation();
  f.query.mockImplementation(async (...args) => {
    if (['COMMIT', 'ROLLBACK'].includes(args[0])) throw Error('PRIVATE lost acknowledgement');
    return native(...args);
  });
  const budget = { finish: jest.fn() }, helper = createAdjudicationBudgetFinalization(budget);
  await expect(helper.claim(1, f.operation)).rejects.toThrow('PRIVATE');
  expect(helper.claimed).toBe(false); expect(helper.notApplied).toBe(false);
  await expect(helper.finish(1, 'captured')).rejects.toThrow('claim_missing');
  await expect(helper.claim(1, f.operation)).rejects.toThrow('claim_missing');
  expect(budget.finish).not.toHaveBeenCalled();
});
