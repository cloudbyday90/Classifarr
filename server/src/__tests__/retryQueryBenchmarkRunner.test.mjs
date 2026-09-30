/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, test, expect } from '@jest/globals';
import { expectedRetryIds, expectedRetryReadinessIds, retryBenchmarkCursor, RETRY_BENCHMARK_SCENARIOS, RETRY_BENCHMARK_TYPES } from '../scripts/retryQueryBenchmark/fixture.mjs';

let scenario;
jest.unstable_mockModule('../scripts/retryQueryBenchmark/dispatch.mjs', () => ({
  measureRetryDispatch: jest.fn().mockResolvedValue([]),
}));
const install = jest.fn(), index = jest.fn(), measure = jest.fn(), readIds = jest.fn();
jest.unstable_mockModule('../scripts/retryQueryBenchmark/writeCost.mjs', () => ({
  measureRetryIndexWriteCost: jest.fn().mockResolvedValue({indexBytes:8192,measurements:[]}),
}));
jest.unstable_mockModule('../scripts/retryQueryBenchmark/schema.mjs', () => ({
  installRetryBenchmarkSchema: install, installRetryBenchmarkCandidateIndex: index, requireRetryBenchmarkSchema: jest.fn(),
}));
jest.unstable_mockModule('../scripts/retryQueryBenchmark/fixture.mjs', () => ({
  expectedRetryIds, expectedRetryReadinessIds, retryBenchmarkCursor, RETRY_BENCHMARK_SCENARIOS, RETRY_BENCHMARK_TYPES,
  seedRetryBenchmark: async (_db, value, size) => { scenario = value; return value === 'empty' ? 0 : size; },
}));
jest.unstable_mockModule('../scripts/retryQueryBenchmark/measurement.mjs', () => ({
  measureRetryQuery: measure, readRetryQueryIds: readIds, retryQueryFingerprint: () => 'fingerprint', summarizeRetryPlan: jest.fn(),
}));
const { runRetryQueryMeasurements } = await import('../scripts/retryQueryBenchmark/runner.mjs');
const db = () => ({ query: jest.fn(async sql => ({ rows: sql.includes('count(*)') ? [{ count: 0 }]
  : sql.includes('to_regnamespace') ? [{ clean: true }] : [] })) });

beforeEach(() => {
  for (const mock of [install, index, measure, readIds]) mock.mockReset();
  install.mockResolvedValue({ snapshotSha256: 'digest' });
  index.mockResolvedValue(4096);
  measure.mockResolvedValue({ executionMs: 1 });
  readIds.mockImplementation(async (_db, { sql, params }) => {
    if (sql.startsWith('WITH pending')) return expectedRetryReadinessIds(scenario,300,params[0]);
    return expectedRetryIds(scenario,300,params[0], (sql.startsWith('SELECT') || sql.startsWith('WITH retry_contexts')) ? params[6] ?? 0 : 0,
      sql.startsWith('WITH candidate') ? 1 : 50);
  });
});

test('compares both strategies and all query paths using one rolled-back transaction per scenario', async () => {
  const store = db();
  const report = await runRetryQueryMeasurements(store, { size: 300 });
  expect(report.measurements).toHaveLength(594);
  expect(report.measurements.every(item => item.repetitions.length === 3 && item.exactIdsVerified)).toBe(true);
  expect(measure).toHaveBeenCalledTimes(1782);
  expect(index).toHaveBeenCalledTimes(11);
  expect(store.query.mock.calls.filter(([sql]) => sql === 'ROLLBACK')).toHaveLength(11);
  expect(report).toMatchObject({ rollbackVerified: true, providerRequests: 0, productionChanges: 0 });
  expect(report.writeCosts.map(cost=>cost.scenario)).toEqual(['all_waiting','credential_rotation','sparse_rotation']);
});

test.each([0,300001,Infinity,1.5])('rejects invalid size %s before any query', async size => {
  const store = db();
  await expect(runRetryQueryMeasurements(store, { size })).rejects.toThrow('size');
  expect(store.query).not.toHaveBeenCalled();
});

test.each(['install', 'measure', 'identity'])('rolls back and stops on %s failure', async failure => {
  const store = db();
  if (failure === 'install') install.mockRejectedValueOnce(new Error('fixture'));
  if (failure === 'measure') measure.mockRejectedValueOnce(new Error('timeout'));
  if (failure === 'identity') readIds.mockResolvedValueOnce([999]);
  await expect(runRetryQueryMeasurements(store, { size: 300 })).rejects.toThrow();
  expect(store.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
  expect(index).not.toHaveBeenCalled();
});

test('detects claim rollback failure instead of publishing success', async () => {
  const store = db();
  store.query.mockImplementation(async sql => ({ rows: sql.includes('count(*)') ? [{ count: 1 }] : [] }));
  await expect(runRetryQueryMeasurements(store, { size: 300 })).rejects.toThrow('claim rollback');
  expect(store.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
});

test('detects retained benchmark namespace after teardown', async () => {
  const store = db();
  store.query.mockImplementation(async sql => ({ rows: sql.includes('count(*)') ? [{ count: 0 }]
    : sql.includes('to_regnamespace') ? [{ clean: false }] : [] }));
  await expect(runRetryQueryMeasurements(store, { size: 300 })).rejects.toThrow('schema rollback');
});
