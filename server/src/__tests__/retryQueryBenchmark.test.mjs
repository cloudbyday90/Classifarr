/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { captureRetryBenchmarkQuery } from '../scripts/retryQueryBenchmark/queries.mjs';
import { summarizeRetryPlan, measureRetryQuery, readRetryQueryIds, retryQueryFingerprint } from '../scripts/retryQueryBenchmark/measurement.mjs';
import { installRetryBenchmarkSchema, installRetryBenchmarkCandidateIndex, requireRetryBenchmarkSchema } from '../scripts/retryQueryBenchmark/schema.mjs';
import { seedRetryBenchmark, expectedRetryIds, expectedRetryReadinessIds, RETRY_BENCHMARK_SCENARIOS } from '../scripts/retryQueryBenchmark/fixture.mjs';
import { runRetryQueryBenchmark } from '../scripts/runRetryQueryBenchmark.mjs';

const scoped = () => ({ query: jest.fn(async sql => ({ rows: sql.startsWith('SELECT current_schema()')
  ? [{ name: 'retry_query_benchmark', installed: true }] : [] })) });

test.each(['page', 'middle_page', 'deep_page', 'baseline_page', 'baseline_middle_page', 'baseline_deep_page', 'readiness', 'claim', 'claim_by_id'])('captures the real %s query and parameters without executing it', async operation => {
  const query = await captureRetryBenchmarkQuery(operation, 'omdb', { priority: 5, queue_id: 90, retry_created_at: '2026-01-01' }, 99);
  expect(query.sql).toContain('enrichment_retry_queue');
  expect(query.params[0]).toBe('omdb');
  expect(query.sql).toContain('enrichment_retry_provider_contexts');
  if (operation === 'claim') expect(query.sql).toContain('FOR UPDATE OF erq SKIP LOCKED');
  if (operation === 'deep_page') expect(query.params.slice(4)).toEqual([5,'2026-01-01',90,50]);
  if (operation === 'readiness') expect(query.params.at(-1)).toBe(51);
  if (operation === 'claim_by_id') expect(query.params.at(-1)).toBe(99);
});

test('rejects unsupported operations and types', async () => {
  await expect(captureRetryBenchmarkQuery('drop', 'omdb')).rejects.toThrow('operation');
  await expect(captureRetryBenchmarkQuery('page', 'music')).rejects.toThrow('type');
});

test('summarizes loops without double-counting parent buffers or exposing predicates', () => {
  const report = summarizeRetryPlan({ 'Planning Time': 1, 'Execution Time': 2, Plan: {
    'Node Type': 'Limit', 'Actual Rows': 1, 'Shared Hit Blocks': 10, Filter: 'PRIVATE', Plans: [
      { 'Node Type': 'Index Scan', 'Relation Name': 'enrichment_retry_queue', 'Index Name': 'example',
        'Actual Rows': 3, 'Actual Loops': 4, 'Rows Removed by Filter': 2, 'Shared Hit Blocks': 8 },
      { 'Node Type': 'Sort', 'Actual Rows': 1, 'Actual Loops': 1, 'Sort Method': 'quicksort', 'Sort Space Used': 25 },
      { 'Node Type': 'Seq Scan', 'Relation Name': 'libraries' },
    ],
  } });
  expect(report).toMatchObject({ sharedHits: 10, sharedReads: 0, executionMs: 2, tempWrites: 0,
    scans: [{ rows: 12, filtered: 8, loops: 4 }, { rows: 0, loops: 0, index: null }],
    sorts: [{ rows: 1, spaceKb: 25 }] });
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
  expect(summarizeRetryPlan({ Plan: {} }).sorts).toEqual([]);
  expect(() => summarizeRetryPlan(null)).toThrow('Missing');
  expect(retryQueryFingerprint('SELECT 1')).toMatch(/^[a-f0-9]{64}$/);
});

test.each([true, false])('EXPLAIN rollback runs even on failure: %s', async fail => {
  const db = scoped();
  db.query.mockImplementation(async sql => {
    if (sql.startsWith('SELECT current_schema')) return { rows: [{ name: 'retry_query_benchmark', installed: true }] };
    if (sql.startsWith('EXPLAIN')) {
      if (fail) throw new Error('timeout');
      return { rows: [{ 'QUERY PLAN': [{ Plan: { 'Actual Rows': 1 } }] }] };
    }
    return { rows: [] };
  });
  const work = measureRetryQuery(db, { sql: 'SELECT 1', params: [] });
  if (fail) await expect(work).rejects.toThrow('timeout');
  else expect(await work).toMatchObject({ returnedRows: 1 });
  expect(db.query.mock.calls.slice(-2)).toEqual([
    ['ROLLBACK TO SAVEPOINT retry_benchmark_measurement'], ['RELEASE SAVEPOINT retry_benchmark_measurement'],
  ]);
});

test.each([true, false])('actual result reads are also rolled back: %s', async fail => {
  const db = scoped();
  db.query.mockImplementation(async sql => {
    if (sql.startsWith('SELECT current_schema')) return { rows: [{ name: 'retry_query_benchmark', installed: true }] };
    if (sql === 'fixture') {
      if (fail) throw new Error('failure');
      return { rows: [{ queue_id: 12 }] };
    }
    return { rows: [] };
  });
  const work = readRetryQueryIds(db, { sql: 'fixture', params: [] });
  if (fail) await expect(work).rejects.toThrow('failure');
  else expect(await work).toEqual([12]);
  expect(db.query.mock.calls.at(-2)).toEqual(['ROLLBACK TO SAVEPOINT retry_benchmark_result']);
});

test.each(['classifarr', undefined, 'classifarr_suite_prod'])('refuses schema installation in %s', async name => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ name }] }) };
  await expect(installRetryBenchmarkSchema(db)).rejects.toThrow('disposable');
  expect(db.query).toHaveBeenCalledTimes(1);
});

test.each(['public', undefined])('refuses measurements outside the owned schema: %s', async name => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ name, installed: true }] }) };
  await expect(requireRetryBenchmarkSchema(db)).rejects.toThrow('not installed');
  await expect(installRetryBenchmarkCandidateIndex(db)).rejects.toThrow('not installed');
});

test('imports current snapshot table definitions, keys, indexes and views only into its own namespace', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ name: 'scan_recovery_benchmark' }] }) };
  const report = await installRetryBenchmarkSchema(db);
  expect(report).toMatchObject({ tableCount: 8, viewCount: 2, snapshotSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
  expect(report.indexCount).toBeGreaterThan(20);
  const writes = db.query.mock.calls.slice(1).map(([sql]) => sql).join('\n');
  expect(writes).toContain('CREATE VIEW retry_query_benchmark.enrichment_retry_provider_contexts');
  expect(writes).not.toMatch(/public\.|FOREIGN KEY|CREATE TRIGGER|IF NOT EXISTS/);
});

test('the index experiment is schema-scoped and reports its storage cost', async () => {
  const db = scoped();
  db.query.mockResolvedValueOnce({ rows: [{ name: 'retry_query_benchmark', installed: true }] })
    .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ bytes: '4096' }] });
  expect(await installRetryBenchmarkCandidateIndex(db)).toBe(4096);
  expect(db.query.mock.calls[1][0]).toContain("WHERE status='pending'");
});

test.each(RETRY_BENCHMARK_SCENARIOS)('seeds bounded %s data and analyses populated relations', async scenario => {
  const db = scoped();
  expect(await seedRetryBenchmark(db, scenario, 300)).toBe(scenario === 'empty' ? 0 : 300);
  if (scenario === 'empty') expect(db.query).toHaveBeenCalledTimes(1);
  else expect(db.query.mock.calls.filter(([sql]) => sql.startsWith('ANALYZE'))).toHaveLength(8);
});

test.each([0,299,300001,NaN,1.5])('rejects unsafe row count %s before querying', async size => {
  const db = scoped();
  await expect(seedRetryBenchmark(db, 'mixed', size)).rejects.toThrow('Invalid');
  expect(db.query).not.toHaveBeenCalled();
});

test('fixture oracle distinguishes guards, deadlines, provider types and cursor bounds', () => {
  expect(expectedRetryIds('all_waiting',300,'omdb')).toEqual([]);
  expect(expectedRetryIds('ready_tail',300,'omdb')).toEqual([300]);
  expect(expectedRetryIds('mixed',300,'omdb',150,1)).toEqual([165]);
  expect(expectedRetryIds('credential_rotation',300,'tavily',0,5)).toEqual([2,5,8,14,17]);
  expect(expectedRetryIds('terminal_history',300,'omdb')).toEqual([288,291,294,297,300]);
  expect(expectedRetryReadinessIds('empty',300,'omdb')).toEqual([]);
  expect(expectedRetryReadinessIds('all_waiting',300,'omdb')).toHaveLength(51);
  expect(expectedRetryReadinessIds('terminal_history',300,'omdb')).toEqual([288,291,294,297,300]);
});

test('CLI refuses source connections and arbitrary flags before starting a container', async () => {
  const start = jest.fn();
  await expect(runRetryQueryBenchmark({ argv: ['--database-url=PRIVATE'], start })).rejects.toThrow('no arguments');
  expect(start).not.toHaveBeenCalled();
});
