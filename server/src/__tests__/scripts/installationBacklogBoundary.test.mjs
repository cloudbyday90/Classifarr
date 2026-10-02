/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { backlogBoundarySettled, readBacklogWorkerLimit, readParkedBacklogWorkers, readBacklogGateWindow } from '../../scripts/installationBacklogBoundary.mjs';

test.each([[[], 5], [[{ key: 'queue_metadata_enrichment_workers', value: '8' }], 8],
  [[{ key: 'queue_metadata_enrichment_workers', value: '999' }], 20]])('uses production normalization for %j', async (rows, expected) => {
  const query = jest.fn(async () => ({ rows }));
  expect(await readBacklogWorkerLimit({ query })).toBe(expected);
  expect(query).toHaveBeenCalledTimes(1);
});

test('a failed configuration read is not assumed to be the default', async () => {
  await expect(readBacklogWorkerLimit({ query: async () => { throw new Error('unavailable'); } })).rejects.toThrow('unavailable');
});

test.each([
  { processing: 5, blocked: 5, handoffs: 2, count: 600, settled: true },
  { processing: 2, blocked: 2, handoffs: 2, count: 600, settled: false },
  { processing: 5, blocked: 4, handoffs: 2, count: 600, settled: false },
  { processing: 5, blocked: 5, handoffs: 1, count: 600, settled: false },
  { processing: 5, blocked: 5, handoffs: 2, count: 599, settled: false },
  { processing: 5, blocked: 5, handoffs: 2, count: 600, completed: true, settled: false },
])('only captures a fully parked boundary: %j', async ({ processing, blocked, handoffs, count, completed, settled }) => {
  const tasks = Array.from({ length: count }, (_, index) => ({ status: index < processing ? 'processing' : 'pending' }));
  if (completed) tasks.at(-1).status = 'completed';
  const query = jest.fn(async sql => ({ rows: sql.includes('FROM task_queue') ? tasks
    : [{ count: sql.includes('FROM pg_stat_activity') ? blocked : handoffs }] }));
  expect(await backlogBoundarySettled({ query }, [1, 2], 5)).toBe(settled);
  expect(query.mock.calls.every(([sql]) => sql.trimStart().startsWith('SELECT'))).toBe(true);
});

test('worker observation requires the scoped fixture name and actual sleep wait', async () => {
  const query = jest.fn(async () => ({ rows: [{ count: 5 }] }));
  expect(await readParkedBacklogWorkers({ query })).toBe(5);
  expect(query.mock.calls[0][0]).toContain("wait_event_type='Timeout' AND wait_event='PgSleep'");
  expect(query.mock.calls[0][1]).toEqual(['classifarr-installation-backlog-gate']);
});

test('remaining gate window is a fresh, scoped read of the oldest active query', async () => {
  const query = jest.fn(async () => ({ rows: [{ count: 5, timed_count: 5, remaining_ms: 4500 }] }));
  expect(await readBacklogGateWindow({ query }, 5)).toBe(4500);
  const [sql, parameters] = query.mock.calls[0];
  expect(sql.trimStart()).toMatch(/^SELECT/);
  expect(sql).toContain('clock_timestamp()-query_start');
  expect(sql).toContain('floor($2 - max(');
  expect(sql).toContain("state='active'");
  expect(sql).toContain("wait_event='PgSleep'");
  expect(parameters).toEqual(['classifarr-installation-backlog-gate', 8000]);
});

test.each([{ count: 4, timed_count: 4, remaining_ms: 4500 }, { count: 5, timed_count: 5, remaining_ms: 0 },
  { count: 5, timed_count: 5, remaining_ms: -1 }, { count: 5, timed_count: 5, remaining_ms: 8001 },
  { count: 5, timed_count: 5, remaining_ms: null }, { count: 5, timed_count: 5, remaining_ms: 1.5 },
  { count: 5, timed_count: 5, remaining_ms: '4500' }, { count: 5, timed_count: 4, remaining_ms: 4500 },
  undefined])('rejects unverified or expired database windows %#', async row => {
  await expect(readBacklogGateWindow({ query: async () => ({ rows: [row] }) }, 5))
    .rejects.toThrow('installation_backlog_window_unavailable');
});

test.each([0, -1, 1.5, '5', null])('invalid expected worker count %j cannot read the database', async expected => {
  const query = jest.fn();
  await expect(readBacklogGateWindow({ query }, expected)).rejects.toThrow('installation_backlog_window_unavailable');
  expect(query).not.toHaveBeenCalled();
});
