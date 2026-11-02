/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createAdjudicationCheckpoint } from '../../services/adjudicationCheckpointRepository.mjs';
import { isAdjudicationCheckpointRefusal } from '../../services/adjudicationCheckpointRefusal.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL, PUBLISH_ADJUDICATION_PROGRESS_SQL } from '../../services/adjudicationBudgetSql.mjs';
import { READ_OWNED_ADJUDICATION_PROGRESS_SQL, READ_REUSABLE_ADJUDICATION_BATCH_SQL,
  RECORD_ADJUDICATION_PROGRESS_SQL } from '../../services/adjudicationCheckpointSql.mjs';
import { fixtureAttemptId } from '../helpers/adjudicationFinalizationFixture.mjs';

const plan = [{ key: 'c'.repeat(64) }];
const template = { version: 'cached_adjudication.v1', configuration: 'a'.repeat(64),
  identity: { model: 'synthetic:latest', digest: 'b'.repeat(64), contextLength: 8192 }, records: [] };
const record = { key: plan[0].key, generated: { response: 'Synthetic response', latencyMs: 1,
  promptTokens: 10, outputTokens: 10, outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' } };
function fixture() {
  const query = jest.fn(async sql => {
    if (sql === READ_OWNED_ADJUDICATION_PROGRESS_SQL) return { rowCount: 1, rows: [{ progress_key: null, progress: null }] };
    if (sql === READ_REUSABLE_ADJUDICATION_BATCH_SQL) return { rowCount: 0, rows: [] };
    return { rowCount: 1, rows: [] }; // Successful DML need not return data rows.
  });
  const transaction = jest.fn(callback => callback({ query }));
  const checkpoint = createAdjudicationCheckpoint(transaction, 1, fixtureAttemptId);
  return { query, transaction, checkpoint };
}
async function prepared() {
  const f = fixture(); await f.checkpoint.open(plan, template); await f.checkpoint.record(record);
  f.query.mockClear(); return f;
}
const invoke = (checkpoint, operation) => operation === 'open' ? checkpoint.open(plan, template)
  : operation === 'record' ? checkpoint.record(record) : checkpoint.publish();

test('missing checkpoint authority starts no transaction', () => {
  const transaction = jest.fn();
  for (const id of [undefined, null, '', 'invalid']) expect(() => createAdjudicationCheckpoint(transaction, 1, id)).toThrow('claim_invalid');
  expect(transaction).not.toHaveBeenCalled();
});

test.each(['open', 'record', 'publish'])('%s observes exact owner absence before further data access', async operation => {
  const f = await prepared(); f.query.mockResolvedValue({ rowCount: 0, rows: [] });
  const error = await invoke(f.checkpoint, operation).catch(value => value);
  expect(isAdjudicationCheckpointRefusal(error)).toBe(true);
  expect(f.query.mock.calls).toEqual([[LOCK_OWNED_ADJUDICATION_BUDGET_SQL, [1, fixtureAttemptId]]]);
});

test.each([undefined, null, {}, { rowCount: null }, { rowCount: '0' }, { rowCount: '1' }, { rowCount: 2 }, { rowCount: -1 }])(
  'malformed owner result %j never proves non-ownership', async result => {
    const f = fixture(); f.query.mockResolvedValue(result);
    const error = await f.checkpoint.open(plan, template).catch(value => value);
    expect(error.message).toBe('adjudication_checkpoint_result_invalid');
    expect(isAdjudicationCheckpointRefusal(error)).toBe(false);
  });

test.each(['record', 'publish'])('%s ordinary zero remains budget-changed, not ownership evidence', async operation => {
  const f = await prepared(); f.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }).mockResolvedValue({ rowCount: 0, rows: [] });
  const error = await invoke(f.checkpoint, operation).catch(value => value);
  expect(error.message).toBe('adjudication_budget_changed');
  expect(isAdjudicationCheckpointRefusal(error)).toBe(false);
});

test.each([undefined, { rowCount: '0' }, { rowCount: 2 }])('malformed DML result %j stays an unknown contract failure', async result => {
  const f = await prepared(); f.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }).mockResolvedValue(result);
  const error = await f.checkpoint.record(record).catch(value => value);
  expect(error.message).toBe('adjudication_checkpoint_result_invalid');
  expect(isAdjudicationCheckpointRefusal(error)).toBe(false);
});

test('zero publication source is an ordinary refusal after a successful progress update', async () => {
  const f = await prepared();
  f.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }).mockResolvedValueOnce({ rowCount: 1, rows: [] })
    .mockResolvedValue({ rowCount: 0, rows: [] });
  const error = await f.checkpoint.publish().catch(value => value);
  expect(error.message).toBe('adjudication_budget_changed');
  expect(isAdjudicationCheckpointRefusal(error)).toBe(false);
});

test('acknowledged commands bind the UUID and accept empty successful DML rows', async () => {
  const f = await prepared(); await f.checkpoint.publish();
  expect(f.query.mock.calls.map(([sql]) => sql)).toEqual([
    LOCK_OWNED_ADJUDICATION_BUDGET_SQL, RECORD_ADJUDICATION_PROGRESS_SQL, PUBLISH_ADJUDICATION_PROGRESS_SQL,
  ]);
  expect(f.query.mock.calls[1][1].at(-1)).toBe(fixtureAttemptId);
  expect(f.query.mock.calls[2][1]).toEqual([1, expect.any(String), fixtureAttemptId]);
});
