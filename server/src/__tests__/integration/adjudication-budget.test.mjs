/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, test, expect } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { projectAdjudicationBudget } from '../../services/adjudicationBudgetContract.mjs';
import { readCachedAdjudication } from '../../services/cachedAdjudicationRepository.mjs';

let repository, db;
const template = () => ({ version: 'cached_adjudication.v1',configuration: 'a'.repeat(64),
  identity: { model: 'test:latest',digest: 'b'.repeat(64),contextLength: 8192 },records: [] });
const request = { key: 'c'.repeat(64),prompt: 'PRIVATE prompt',count: 2 };
const record = () => ({ key: request.key,generated: { response: 'PRIVATE output',latencyMs: 1,promptTokens: 10,outputTokens: 10,
  outputLimitReached: false,contextLimitSuspected: false,inputTruncation: 'unknown' } });
const configure = async (dailyCalls = 10,dailyTokens = 84480) => repository.configure({ dailyCalls,dailyTokens });
const query = (...args) => getPool().query(...args);
beforeEach(async () => {
  await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch; INSERT INTO adjudication_capture_budget(singleton) VALUES(true)');
  db = createIntegrationDatabaseModuleMock(); repository = createAdjudicationBudgetRepository(db);
});

test('default off, concurrent atomic reservation, restart and configuration changes cannot reset quotas', async () => {
  await query('TRUNCATE adjudication_capture_budget'); // Fresh schema snapshot has no singleton data.
  expect(await repository.read()).toMatchObject({ daily_calls: 0,tokens_reserved: 0 });
  await expect(repository.reserve(0)).rejects.toThrow('exhausted');
  const state = await configure(10,16896);
  const results = await Promise.allSettled(Array.from({ length: 20 },() => repository.reserve(state.revision)));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
  repository = createAdjudicationBudgetRepository(db);
  expect(await repository.read()).toMatchObject({ calls_reserved: 2,tokens_reserved: 16896 });
  const raised = await configure(20,168960);
  expect(raised.calls_reserved).toBe(2);
  await expect(repository.reserve(state.revision)).rejects.toThrow('exhausted');
  const disabled = await configure(0,0);
  await expect(repository.reserve(disabled.revision)).rejects.toThrow('exhausted');
  expect((await repository.read()).calls_reserved).toBe(2);
});

test('UTC rollover replenishes once, future quota day fails closed, and database enforces bounds', async () => {
  const state = await configure(1,8448); await repository.reserve(state.revision);
  await query("UPDATE adjudication_capture_budget SET quota_day=quota_day-1");
  expect(await repository.read()).toMatchObject({ calls_reserved: 0,tokens_reserved: 0 });
  await repository.reserve(state.revision);
  await expect(repository.reserve(state.revision)).rejects.toThrow('exhausted');
  await query("UPDATE adjudication_capture_budget SET quota_day=quota_day+1,calls_reserved=0,tokens_reserved=0");
  await expect(repository.reserve(state.revision)).rejects.toThrow('exhausted');
  for (const assignment of ["quota_day='infinity'",'daily_calls=201','tokens_reserved=1',"status='PRIVATE'",'selection_offset=300',
    "progress='{}',progress_key=repeat('a',64),captured_at=now(),expires_at=now()+interval '8 days'"]) {
    await expect(query(`UPDATE adjudication_capture_budget SET ${assignment}`)).rejects.toMatchObject({ code: '23514' });
  }
});

test('response checkpoints survive interruption, never persist prompts, and publish without renewing retention', async () => {
  const state = await configure(), checkpoint = repository.checkpoint(state.revision);
  expect((await checkpoint.open([request],template())).records).toEqual([]);
  await repository.reserve(state.revision); await checkpoint.record(record());
  const before = (await query('SELECT captured_at,expires_at FROM adjudication_capture_budget')).rows[0];
  // Simulated restart after the response checkpoint but before publication.
  const resumed = createAdjudicationBudgetRepository(db).checkpoint(state.revision);
  expect((await resumed.open([request],template())).records).toEqual([record()]);
  await resumed.publish();
  expect(await readCachedAdjudication(getPool(),template().configuration)).toEqual({ ...template(),records: [record()] });
  expect((await query('SELECT captured_at,expires_at FROM cached_adjudication_batch')).rows[0]).toEqual(before);
  expect(JSON.stringify((await query('SELECT progress FROM adjudication_capture_budget')).rows)).not.toContain('PRIVATE prompt');
  expect(JSON.stringify(projectAdjudicationBudget(await repository.read()))).not.toMatch(/PRIVATE|digest|progress|test:latest/);
  await repository.advance(state.revision,60);
  expect((await repository.read()).selection_offset).toBe(25);
  const reuse = repository.checkpoint(state.revision);
  expect((await reuse.open([request],template())).records).toEqual([record()]);
  expect((await query('SELECT captured_at,expires_at FROM adjudication_capture_budget')).rows[0]).toEqual(before);
  await repository.advance(state.revision,60);
  const unrelated = repository.checkpoint(state.revision);
  expect((await unrelated.open([{ ...request,key: 'e'.repeat(64) }],template())).records).toEqual([]);
  expect((await query('SELECT captured_at FROM adjudication_capture_budget')).rows[0].captured_at.getTime()).toBeGreaterThan(before.captured_at.getTime());
  await expect(unrelated.record(record())).rejects.toThrow('invalid');
});

test('disable fences in-flight response publication and subsequent admission without refunding attempts', async () => {
  const state = await configure(), checkpoint = repository.checkpoint(state.revision);
  await checkpoint.open([request],template()); await repository.reserve(state.revision);
  await configure(0,0);
  await expect(checkpoint.record(record())).rejects.toThrow('changed');
  await expect(checkpoint.publish()).rejects.toThrow('changed');
  await expect(repository.reserve(state.revision)).rejects.toThrow('exhausted');
  expect((await repository.read()).calls_reserved).toBe(1);
  expect(await readCachedAdjudication(getPool(),template().configuration)).toBeNull();
});

test('publication follows the requested record order and rejects responses not checkpointed by this plan', async () => {
  const state = await configure(), checkpoint = repository.checkpoint(state.revision);
  const other = { ...request,key: 'e'.repeat(64) }, otherRecord = { ...record(),key: other.key };
  await checkpoint.open([request,other],template()); await checkpoint.record(record()); await checkpoint.record(otherRecord);
  const next = { ...template(),records: [otherRecord,record()] };
  await checkpoint.publish(next);
  expect(await readCachedAdjudication(getPool(),template().configuration)).toEqual(next);
  next.records[0].generated.response = 'not checkpointed';
  await expect(checkpoint.publish(next)).rejects.toThrow('invalid');
});

test('changed plans/models cannot reuse unrelated responses; expired/future progress is removed even while disabled', async () => {
  const state = await configure(), checkpoint = repository.checkpoint(state.revision);
  await checkpoint.open([request],template()); await checkpoint.record(record());
  const different = template(); different.identity.digest = 'd'.repeat(64);
  expect((await repository.checkpoint(state.revision).open([request],different)).records).toEqual([]);
  await query("UPDATE adjudication_capture_budget SET captured_at=now()-interval '8 days',expires_at=now()-interval '1 day'");
  await configure(0,0); await repository.read();
  expect((await query('SELECT progress FROM adjudication_capture_budget')).rows[0].progress).toBeNull();
  await configure(); const current = await repository.read();
  await repository.checkpoint(current.revision).open([request],template());
  await query("UPDATE adjudication_capture_budget SET captured_at=now()+interval '1 day',expires_at=now()+interval '2 days'");
  await repository.read(); expect((await query('SELECT progress FROM adjudication_capture_budget')).rows[0].progress).toBeNull();
});

test('cooldown survives restart, rotation wraps, invalid output cannot checkpoint and migration is idempotent', async () => {
  const state = await configure(); await repository.finish(state.revision,'unavailable');
  expect(await createAdjudicationBudgetRepository(db).read()).toMatchObject({ status: 'unavailable',cooling_down: true });
  await repository.advance(state.revision,25); expect((await repository.read()).selection_offset).toBe(0);
  const checkpoint = repository.checkpoint(state.revision); await checkpoint.open([request],template());
  await expect(checkpoint.record({ key: request.key,generated: { response: 'invalid' } })).rejects.toThrow('invalid');
  expect(() => repository.finish(state.revision,'PRIVATE')).toThrow('invalid');
  const sql = await readFile(new URL('../../../../database/migrations/20260925_120000_add_adjudication_capture_budget.sql',import.meta.url),'utf8');
  await query(sql); await query(sql);
  expect((await repository.read()).daily_calls).toBe(10);
});
