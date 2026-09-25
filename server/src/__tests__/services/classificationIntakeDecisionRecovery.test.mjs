/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { ClassificationIntakeDecisionRecovery } from '../../services/classificationIntakeDecisionRecovery.mjs';
import { READ_INTAKE_DECISION_RECOVERY_SQL, FILL_INTAKE_DECISION_CONTEXTS_SQL } from '../../services/classificationIntakeDecisionRecoverySql.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';

const capture = buildClassificationDestinationDecision({ metadata: { media_type: 'movie', tmdb_id: 42 },
  method: 'ai_analysis', status: 'completed', libraryId: 3 });
const row = overrides => ({ queue_task_id: 1, classification_id: 2, media_type: 'movie', tmdb_id: 42,
  method: 'ai_analysis', capture, ...overrides });

test('fills only validated original context, never raw source fields or guessed placements', async () => {
  const rows = [row({ title: 'private', metadata: { secret: true } }), row({ capture: null }), row({ method: 'manual' }),
    row({ media_type: 'music' }), row({ tmdb_id: 43 }), row({ capture: { ...capture, extra: true } })];
  const db = { query: jest.fn().mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rowCount: 1 }) };
  expect(await new ClassificationIntakeDecisionRecovery({ db }).run()).toBe(1);
  expect(db.query).toHaveBeenCalledWith(READ_INTAKE_DECISION_RECOVERY_SQL, ['0']);
  expect(db.query).toHaveBeenCalledWith(FILL_INTAKE_DECISION_CONTEXTS_SQL, [JSON.stringify([
    { queue_task_id: '1', classification_id: 2, decision_context: { classificationId: 2, capture } },
  ])]);
});

test('a fixed invalid first page cannot starve the next page; the cursor wraps after exhaustion', async () => {
  const rows = Array.from({ length: 500 }, (_, index) => row({ queue_task_id: index + 1, capture: null }));
  const db = { query: jest.fn().mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rows: [] }).mockResolvedValue({ rows: [] }) };
  const recovery = new ClassificationIntakeDecisionRecovery({ db });
  expect(await recovery.run()).toBe(0);
  expect(await recovery.run()).toBe(0);
  expect(await recovery.run()).toBe(0);
  expect(db.query.mock.calls.map(([, params]) => params)).toEqual([['0'], ['500'], ['0']]);
});

test.each([null, Array(501).fill(row())])('rejects invalid row budget before any writes', async rows => {
  const db = { query: jest.fn().mockResolvedValue({ rows }) };
  await expect(new ClassificationIntakeDecisionRecovery({ db }).run()).rejects.toThrow('row_budget');
  expect(db.query).toHaveBeenCalledTimes(1);
});

test.each([0, -1, true, null, 1.5, Number.MAX_SAFE_INTEGER + 1, '9223372036854775808', '01', 'private'])('rejects unsafe queue cursor %j', async queue_task_id => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [row({ queue_task_id })] }) };
  await expect(new ClassificationIntakeDecisionRecovery({ db }).run()).rejects.toThrow('invalid_id');
  expect(db.query).toHaveBeenCalledTimes(1);
});

test('preserves bigint cursor identity beyond JavaScript safe integers', async () => {
  const rows = Array.from({ length: 500 }, (_, index) => row({ queue_task_id: String(9223372036854775308n + BigInt(index)), capture: null }));
  const db = { query: jest.fn().mockResolvedValueOnce({ rows }).mockResolvedValue({ rows: [] }) };
  const recovery = new ClassificationIntakeDecisionRecovery({ db });
  await recovery.run();
  await recovery.run();
  expect(db.query.mock.calls[1][1]).toEqual(['9223372036854775807']);
});

test('failed writes preserve cursor and overlapping calls share one retryable pass', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const rows = Array.from({ length: 500 }, (_, index) => row({ queue_task_id: index + 1 }));
  const db = { query: jest.fn().mockReturnValueOnce(pending).mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rowCount: 500 }) };
  const recovery = new ClassificationIntakeDecisionRecovery({ db });
  const first = recovery.run();
  expect(recovery.run()).toBe(first);
  release({ rows });
  await expect(first).rejects.toThrow('unavailable');
  expect(await recovery.run()).toBe(500);
  expect(db.query.mock.calls[2][1]).toEqual(['0']);
});
