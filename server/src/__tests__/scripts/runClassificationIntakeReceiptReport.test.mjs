/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { runClassificationIntakeReceiptReport } from '../../scripts/runClassificationIntakeReceiptReport.mjs';

function runtimeFor(rowsBySql, queries) {
  const close = jest.fn();
  return { close, load: async () => ({ close, withTransaction: callback => callback({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: rowsBySql(sql) };
    },
  }) }) };
}

test('fixed-window report is read-only, bounded and keeps webhook and receipt populations separate', async () => {
  const queries = [];
  const { load, close } = runtimeFor(sql => {
    if (sql.includes('GROUP BY status_id')) return [{ status_id: 'completed', event_count: '2' }];
    if (sql.includes('FROM webhook_log')) return [{ status_id: 'queued', event_count: '2' }];
    if (sql.includes('ORDER BY queued_at')) return Array.from({ length: 3 }, (_, n) => ({ queue_task_id: n + 1 }));
    return [];
  }, queries);
  const report = await runClassificationIntakeReceiptReport({
    argv: ['--since', '2026-09-01T00:00:00Z', '--until', '2026-09-02T00:00:00Z', '--limit', '2'],
    now: Date.parse('2026-09-03T00:00:00Z'), load,
  });
  expect(report).toMatchObject({ version: 'classification_intake_receipts_v1', truncated: true,
    receipts: [{ queue_task_id: 1 }, { queue_task_id: 2 }],
    notes: ['webhook_groups_are_separate_population', 'missing_receipt_is_not_evidence_of_no_request'] });
  expect(queries[0].sql).toContain('READ ONLY');
  expect(queries.at(-1).params).toEqual(['2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z', 3]);
  expect(queries.every(({ sql }) => !/INSERT|UPDATE|DELETE/i.test(sql))).toBe(true);
  expect(close).toHaveBeenCalledTimes(1);
});

test('exact task lookup accepts only a bounded positive database ID', async () => {
  const queries = [];
  const { load } = runtimeFor(sql => sql.includes('WHERE queue_task_id') ? [{ queue_task_id: '99' }] : [], queries);
  expect(await runClassificationIntakeReceiptReport({ argv: ['--task-id', '99'], load }))
    .toEqual({ version: 'classification_intake_receipts_v1', task: { queue_task_id: '99' } });
  expect(queries.at(-1).params).toEqual(['99']);
  for (const value of ['0', '-1', '99 OR 1=1', '9223372036854775808']) {
    await expect(runClassificationIntakeReceiptReport({ argv: [`--task-id=${value}`], load }))
      .rejects.toThrow('classification_intake_report_task_id');
  }
});

test('rejects future, overlong and malformed windows before connecting', async () => {
  const load = jest.fn();
  for (const argv of [
    ['--since', '2026-07-01T00:00:00Z', '--until', '2026-09-01T00:00:00Z'],
    ['--since', '2026-09-02T00:00:00Z', '--until', '2026-09-01T00:00:00Z'],
    ['--since', 'not-a-date'], ['--limit', '101'],
  ]) {
    await expect(runClassificationIntakeReceiptReport({ argv, now: Date.parse('2026-09-03T00:00:00Z'), load }))
      .rejects.toThrow('classification_intake_report_window');
  }
  expect(load).not.toHaveBeenCalled();
});
