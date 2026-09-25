/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, beforeEach, expect, test } from '@jest/globals';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { sourcePairWindowFixture, completedWindowReport } from '../fixtures/sourcePairWindowFixture.mjs';
import { advanceEvaluatedSourcePairWindow } from '../../services/sourcePairWindowProgressionRepository.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';

let base, db;
const fingerprint = 'a'.repeat(64);
const query = (...args) => getPool().query(...args);
const stored = async () => (await query('SELECT * FROM adjudication_capture_budget')).rows[0];
const advance = (revision = 0, selectionOffset = 0, nextOffset = 25) => db.withTransaction(client =>
  advanceEvaluatedSourcePairWindow(client, fingerprint, completedWindowReport(base, { offset: selectionOffset }),
    { revision, selectionOffset, nextOffset }));
beforeAll(async () => { base = (await sourcePairWindowFixture()).result.report; });
beforeEach(async () => {
  await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch');
  db = createIntegrationDatabaseModuleMock();
});

test('fresh disabled installation, duplicate concurrency and restart advance once without touching quota or status', async () => {
  await Promise.all(Array.from({ length: 10 }, () => advance()));
  expect(await stored()).toMatchObject({ revision: 1, selection_offset: 25, daily_calls: 0, daily_tokens: 0,
    calls_reserved: 0, tokens_reserved: 0, status: 'disabled' });
  const before = await stored(); db = createIntegrationDatabaseModuleMock();
  await advance(); expect(await stored()).toEqual(before);
  await advance(1, 25, 0); expect(await stored()).toMatchObject({ revision: 2, selection_offset: 0 });
  await advance(); expect(await stored()).toMatchObject({ revision: 2, selection_offset: 0 });
  await advance(2); expect(await stored()).toMatchObject({ revision: 3, selection_offset: 25 });
});

test('exhausted budget progresses but reservations, quota day, status and cooldown remain unchanged', async () => {
  const budget = createAdjudicationBudgetRepository(db), state = await budget.configure({ dailyCalls: 1, dailyTokens: 8448 });
  await budget.reserve(state.revision); await budget.finish(state.revision, 'unavailable');
  const before = await stored(); await advance(state.revision);
  expect(await stored()).toEqual({ ...before, revision: state.revision + 1, selection_offset: 25 });
  await expect(budget.reserve(state.revision + 1)).rejects.toThrow('exhausted');
});

test('configuration edits and cursor mismatch fence an old evaluation', async () => {
  const budget = createAdjudicationBudgetRepository(db);
  const first = await budget.configure({ dailyCalls: 1, dailyTokens: 8448 });
  const disabled = await budget.configure({ dailyCalls: 0, dailyTokens: 0 });
  const before = await stored(); await advance(first.revision); expect(await stored()).toEqual(before);
  await query('UPDATE adjudication_capture_budget SET selection_offset=25');
  await advance(disabled.revision); expect((await stored()).revision).toBe(disabled.revision);
});

test.each(['unpublished', 'unrelated', 'matching', 'expired', 'future'])('%s checkpoint is protected or consumed according to provenance and retention', async kind => {
  await query(`INSERT INTO adjudication_capture_budget(singleton,progress_key,progress,captured_at,expires_at,published_fingerprint)
    VALUES(true,repeat('b',64),'{}',now(),now()+interval '1 day',$1)`,
  [kind === 'matching' ? fingerprint : kind === 'unrelated' ? 'c'.repeat(64) : null]);
  if (kind === 'expired') await query("UPDATE adjudication_capture_budget SET captured_at=now()-interval '2 days',expires_at=now()-interval '1 day'");
  if (kind === 'future') await query("UPDATE adjudication_capture_budget SET captured_at=now()+interval '1 day',expires_at=now()+interval '2 days'");
  const before = await stored(); await advance();
  if (['unpublished', 'unrelated'].includes(kind)) expect(await stored()).toEqual(before);
  else expect(await stored()).toMatchObject({ revision: 1, selection_offset: 25,
    progress: null, progress_key: null, captured_at: null, expires_at: null, published_fingerprint: null });
});

test('unrelated publication without a checkpoint remains intact and rollback does not consume completion', async () => {
  await query("INSERT INTO adjudication_capture_budget(singleton,published_fingerprint) VALUES(true,repeat('c',64))");
  await advance(); expect(await stored()).toMatchObject({ revision: 0, selection_offset: 0, published_fingerprint: 'c'.repeat(64) });
  await query('UPDATE adjudication_capture_budget SET published_fingerprint=$1', [fingerprint]);
  const before = await stored();
  await expect(db.withTransaction(async client => {
    await advanceEvaluatedSourcePairWindow(client, fingerprint, completedWindowReport(base),
      { revision: 0, selectionOffset: 0, nextOffset: 25 });
    throw new Error('simulate publication rollback');
  })).rejects.toThrow('rollback');
  expect(await stored()).toEqual(before);
});
