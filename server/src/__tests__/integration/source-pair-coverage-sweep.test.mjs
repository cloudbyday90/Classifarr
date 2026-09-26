/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, beforeEach, expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { sourcePairWindowFixture, completedWindowReport } from '../fixtures/sourcePairWindowFixture.mjs';
import { readSourcePairSweepCursor, advanceSourcePairSweep } from '../../services/sourcePairCoverageSweepRepository.mjs';

let base, database;
const scope = 'a'.repeat(64);
const query = (...args) => getPool().query(...args);
const stored = () => readSourcePairSweepCursor({ query });
const window = (revision = 0, selectionOffset = 0, evidenceRevision = null, nextOffset = 25, nextEvidenceRevision = scope) =>
  ({ revision, selectionOffset, evidenceRevision, nextOffset, nextEvidenceRevision });
const advance = (intent = window(), offset = 0) => database.withTransaction(client =>
  advanceSourcePairSweep(client, completedWindowReport(base, { offset }), intent));
beforeAll(async () => { base = (await sourcePairWindowFixture()).result.report; });
beforeEach(async () => {
  await query('TRUNCATE automatic_source_pair_sweep');
  database = createIntegrationDatabaseModuleMock();
});

test('concurrent fresh starts, restart, wraparound and late publication advance only once', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => advance()));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await stored()).toEqual({ revision: 1, selectionOffset: 25, evidenceRevision: scope });
  database = createIntegrationDatabaseModuleMock();
  expect(await advance()).toBe(false);
  expect(await advance(window(1, 25, scope, 0), 25)).toBe(true);
  expect(await advance()).toBe(false);
  expect(await stored()).toEqual({ revision: 2, selectionOffset: 0, evidenceRevision: scope });
  expect(await advance(window(2, 0, scope))).toBe(true);
});

test('scope, offset and revision predicates reject late writers independently', async () => {
  await advance();
  const before = await stored();
  expect(await advance(window(0, 25, scope, 0), 25)).toBe(false);
  expect(await advance(window(1, 0, scope))).toBe(false);
  expect(await advance(window(1, 25, 'b'.repeat(64), 25))).toBe(false);
  expect(await stored()).toEqual(before);
  expect(await advance(window(1, 25, scope, 25, 'c'.repeat(64)))).toBe(true);
  expect(await stored()).toEqual({ revision: 2, selectionOffset: 25, evidenceRevision: 'c'.repeat(64) });
});

test('transaction rollback leaves a fresh cursor absent and an existing cursor unchanged', async () => {
  const rollback = intent => database.withTransaction(async client => {
    await advanceSourcePairSweep(client, completedWindowReport(base, { offset: intent.selectionOffset }), intent);
    throw new Error('simulate report failure');
  });
  await expect(rollback(window())).rejects.toThrow('report failure');
  expect((await query('SELECT * FROM automatic_source_pair_sweep')).rows).toHaveLength(0);
  await advance(); const before = await stored();
  await expect(rollback(window(1, 25, scope, 0))).rejects.toThrow('report failure');
  expect(await stored()).toEqual(before);
});

test('additive migration creates, replays and preserves existing state without touching capture', async () => {
  const migration = await readFile(new URL('../../../../database/migrations/20260925_160000_add_source_pair_sweep.sql', import.meta.url), 'utf8');
  const captureBefore = (await query('SELECT * FROM adjudication_capture_budget')).rows;
  // Disposable integration database only. Recreate the one new table to exercise an upgrade.
  await query('DROP TABLE automatic_source_pair_sweep');
  await query(migration); await advance(); const before = await stored();
  await query(migration); expect(await stored()).toEqual(before);
  expect((await query('SELECT * FROM adjudication_capture_budget')).rows).toEqual(captureBefore);
});

test.each([['revision', -1], ['selection_offset', -1], ['selection_offset', 300], ['evidence_revision', 'private'], ['singleton', false]])(
  'database rejects %s=%s outside the bounded cursor contract', async (column, value) => {
    // Column comes only from the fixed test cases above, never external input.
    await expect(query(`INSERT INTO automatic_source_pair_sweep(${column}) VALUES($1)`, [value])).rejects.toMatchObject({ code: '23514' });
  });
