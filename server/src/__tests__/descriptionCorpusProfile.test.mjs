/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { summarizeCorpusPlan, observeCorpusWork, memorySnapshot } from '../scripts/descriptionCorpusProfile/observation.mjs';
import { requireProfileDatabase, installCorpusProfileFixture, removeCorpusProfileFixture } from '../scripts/descriptionCorpusProfile/fixture.mjs';
import { measureCorpusRead, corpusQuerySha256 } from '../scripts/descriptionCorpusProfile/measurement.mjs';
import { runCorpusProfileMeasurements, verifyCorpusLockControl } from '../scripts/descriptionCorpusProfile/runner.mjs';

test('plan output is numeric-only, bounded, and never double-counts inclusive buffers', () => {
  const plan = { Plan: { 'Plan Rows': 4, 'Actual Rows': 20, 'Shared Hit Blocks': 100,
    Filter: 'private', Plans: [{ 'Shared Hit Blocks': 80, 'Sort Space Type': 'Disk', 'Sort Space Used': 123,
      'Relation Name': 'private', 'Index Cond': 'private' }] }, 'Planning Time': 1, 'Execution Time': 2,
    Serialization: { Time: 3, 'Output Volume': 5, private: 'private' } };
  expect(summarizeCorpusPlan(plan)).toMatchObject({ sharedHits: 100, nodes: 2, diskSorts: 1,
    sortSpaceKb: 123, serializationMs: 3, serializationKb: 5, actualRows: 20 });
  expect(JSON.stringify(summarizeCorpusPlan(plan))).not.toContain('private');
  expect(summarizeCorpusPlan({ Plan: { 'Actual Rows': Infinity }, 'Execution Time': -1 })).toMatchObject({ actualRows: null, executionMs: null });
  expect(() => summarizeCorpusPlan({})).toThrow('invalid');
  expect(() => summarizeCorpusPlan({ Plan: { Plans: Array.from({ length: 500 }, () => ({})) } })).toThrow('too_large');
  expect(memorySnapshot()).toEqual({ rss: expect.any(Number), heapUsed: expect.any(Number),
    heapTotal: expect.any(Number), external: expect.any(Number), arrayBuffers: expect.any(Number) });
  expect(corpusQuerySha256).toMatch(/^[a-f0-9]{64}$/);
});

test('samples only fixed categories and owned PIDs, without selecting SQL text', async () => {
  const observer = { query: jest.fn(async () => ({ rows: [
    { state: 'active', wait_event_type: 'Lock' }, { state: 'active', wait_event_type: null },
    { state: 'idle', wait_event_type: 'Client' }, { state: 'active', wait_event_type: 'private' },
  ] })) };
  const report = await observeCorpusWork(observer, [1, 2], async () => 'complete');
  expect(report).toMatchObject({ result: 'complete', waits: { samples: 1,
    categories: { Lock: 1, active_no_wait: 1, not_active: 1, other: 1 } } });
  expect(observer.query.mock.calls[0][1]).toEqual([[1, 2]]);
  expect(observer.query.mock.calls[0][0]).not.toMatch(/SELECT.*query,/);
  expect(JSON.stringify(report)).not.toContain('private');
});

test('observer and work failures settle before returning, with sanitized observer errors', async () => {
  const workError = new Error('work');
  let settled = false;
  const observer = { query: async () => { await new Promise(resolve => { setTimeout(resolve, 5); }); settled = true; throw new Error('private'); } };
  await expect(observeCorpusWork(observer, [1], async () => { throw workError; })).rejects.toBe(workError);
  expect(settled).toBe(true);
  await expect(observeCorpusWork(observer, [1], async () => 'ok')).rejects.toThrow('corpus_profile_observer_failed');
});

test.each([[], [0], [1, 2, 3], ['1'], [1.2]].map(pids => [pids]))('invalid PIDs cannot query: %j', async pids => {
  const observer = { query: jest.fn() };
  await expect(observeCorpusWork(observer, pids, jest.fn())).rejects.toThrow('pids_invalid');
  expect(observer.query).not.toHaveBeenCalled();
});

test.each(['classifarr', 'postgres', 'classifarr_suite_bad', null])('rejects non-fixture database %s before DDL', async name => {
  const db = { query: jest.fn(async () => ({ rows: [{ name }] })) };
  await expect(requireProfileDatabase(db)).rejects.toThrow('disposable_database_required');
  await expect(installCorpusProfileFixture(db, 100, 'sparse')).rejects.toThrow('disposable_database_required');
  await expect(removeCorpusProfileFixture(db)).rejects.toThrow('disposable_database_required');
  expect(db.query.mock.calls.every(([sql]) => sql === 'SELECT current_database() AS name')).toBe(true);
});

test.each([0, 99, 6501, 1.2, Infinity])('invalid sizes fail before connections or DDL: %s', async size => {
  const db = { query: jest.fn() }, withClient = jest.fn();
  await expect(installCorpusProfileFixture(db, size, 'sparse')).rejects.toThrow('fixture_invalid');
  await expect(runCorpusProfileMeasurements(db, { withClient, size })).rejects.toThrow('options_invalid');
  expect(db.query).not.toHaveBeenCalled(); expect(withClient).not.toHaveBeenCalled();
});

test('failed fixture install rolls back; cleanup must be verified', async () => {
  const db = { query: jest.fn(async sql => {
    if (sql.startsWith('CREATE TABLE')) throw new Error('fixture failure');
    return { rows: [{ name: 'scan_recovery_benchmark', clean: false }] };
  }) };
  await expect(installCorpusProfileFixture(db, 100, 'sparse')).rejects.toThrow('fixture failure');
  expect(db.query.mock.calls.at(-1)[0]).toBe('ROLLBACK');
  await expect(removeCorpusProfileFixture(db)).rejects.toThrow('cleanup_failed');
});

test.each(['select', 'plan', 'serialize'])('measurement preserves deadlines/read-only mode and rolls back %s failures', async mode => {
  const error = new Error('private');
  const db = { query: jest.fn(async sql => {
    if (sql.includes('SELECT msi.')) throw error;
    return { rows: [] };
  }) };
  await expect(measureCorpusRead(db, 10, mode)).rejects.toBe(error);
  expect(db.query.mock.calls[0][0]).toBe('BEGIN READ ONLY');
  expect(db.query.mock.calls[1][0]).toContain("statement_timeout='15s'");
  expect(db.query.mock.calls[1][0]).toContain("lock_timeout='2s'");
  expect(db.query.mock.calls.at(-1)[0]).toBe('ROLLBACK');
});

test('invalid modes and mismatched results cannot be success', async () => {
  const db = { query: jest.fn(async () => ({ rows: [] })) };
  await expect(measureCorpusRead(db, 1, 'private')).rejects.toThrow('mode_invalid');
  expect(db.query).not.toHaveBeenCalled();
  await expect(measureCorpusRead(db, 1)).rejects.toThrow('result_mismatch');
});

test('lock control requires both observed Lock samples and matching SQLSTATE', async () => {
  const db = { query: jest.fn(async () => ({ rows: [] })) };
  const observer = { query: jest.fn(async () => ({ rows: [] })) };
  await expect(verifyCorpusLockControl(db, db, observer, 1)).rejects.toThrow('lock_control_failed');
  expect(db.query.mock.calls.at(-1)[0]).toBe('ROLLBACK');
});
