/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { evaluationHistoryFixture } from '../fixtures/evaluationHistoryFixture.mjs';
import { appendEvaluationHistory, readEvaluationHistory, PRUNE_EVALUATION_HISTORY_SQL } from '../../services/evaluationHistoryRepository.mjs';
import { adjudicationDigest } from '../../services/cachedAdjudicationContract.mjs';
import { evaluationHistoryCase } from '../../services/evaluationHistoryContract.mjs';

const query = (...args) => getPool().query(...args);
const database = () => createIntegrationDatabaseModuleMock();
const save = async history => database().withTransaction(async client => {
  const { rows: [clock] } = await client.query('SELECT now()::text AS at');
  await appendEvaluationHistory(client, history, clock.at);
});
beforeEach(async () => { await query('TRUNCATE automatic_evaluation_history'); });

test('idempotent categorical windows survive restart and JSONB key ordering without renewed retention', async () => {
  await save(evaluationHistoryFixture());
  const first = (await query('SELECT * FROM automatic_evaluation_history')).rows[0];
  await save(first.result); // Read-back JSONB key order differs from JS creation order.
  const retained = (await query('SELECT * FROM automatic_evaluation_history')).rows;
  expect(retained).toHaveLength(1);
  expect(retained[0]).toMatchObject({ result_key: first.result_key, observed_at: first.observed_at, result: first.result });
  await save(evaluationHistoryFixture({ offset: 20 }));
  await save(evaluationHistoryFixture({ status: 'misses' }));
  const report = await readEvaluationHistory(database());
  expect(report).toMatchObject({ windows: 3, revisions: 1 });
  expect(report.groups[0]).toMatchObject({ selected: 45, paired: 45, labeled: 45, gains: 45 });
});

test('rollback publishes neither partial history nor duplicates', async () => {
  await expect(database().withTransaction(async client => {
    const { rows: [clock] } = await client.query('SELECT now()::text AS at');
    await appendEvaluationHistory(client, evaluationHistoryFixture(), clock.at);
    throw new Error('interrupted');
  })).rejects.toThrow('interrupted');
  expect((await readEvaluationHistory(database())).windows).toBe(0);
  await save(evaluationHistoryFixture());
  expect((await readEvaluationHistory(database())).windows).toBe(1);
});

test('read-only filtering and scheduled pruning enforce 30 days, future clock exclusion and 500 windows', async () => {
  await query(`INSERT INTO automatic_evaluation_history(result_key,observed_at,last_observed_at,result)
    SELECT lpad(to_hex(n),64,'0'),now()-n*interval '1 minute',now()-n*interval '1 minute',$1::jsonb FROM generate_series(1,501) n`, [JSON.stringify(evaluationHistoryFixture())]);
  expect((await readEvaluationHistory(database())).windows).toBe(500);
  expect(Number((await query('SELECT count(*) FROM automatic_evaluation_history')).rows[0].count)).toBe(501);
  await query(PRUNE_EVALUATION_HISTORY_SQL);
  expect(Number((await query('SELECT count(*) FROM automatic_evaluation_history')).rows[0].count)).toBe(500);
  await query("UPDATE automatic_evaluation_history SET observed_at=now()-interval '31 days'");
  expect((await readEvaluationHistory(database())).windows).toBe(0);
  await query("UPDATE automatic_evaluation_history SET observed_at=now()+interval '1 day',last_observed_at=now()+interval '1 day'");
  expect((await readEvaluationHistory(database())).windows).toBe(0);
  await query(PRUNE_EVALUATION_HISTORY_SQL);
  expect(Number((await query('SELECT count(*) FROM automatic_evaluation_history')).rows[0].count)).toBe(0);
  await database().withTransaction(client => appendEvaluationHistory(client, evaluationHistoryFixture(), '2099-01-01'));
  expect((await readEvaluationHistory(database())).windows).toBe(0);
});

test('schema rejects missing version/cases, oversized records and non-finite dates', async () => {
  for (const [date, value] of [['infinity', evaluationHistoryFixture()], ['2026-09-25', {}],
    ['2026-09-25', { version: 'evaluation_history.v1' }], ['2026-09-25', { version: 'evaluation_history.v1', cases: Array(26).fill({}) }],
    ['2026-09-25', { version: 'evaluation_history.v1', cases: [], private: 'x'.repeat(17000) }]]) {
    await expect(query('INSERT INTO automatic_evaluation_history(result_key,observed_at,last_observed_at,result) VALUES($1,$2,$2,$3)', ['a'.repeat(64), date, JSON.stringify(value)]))
      .rejects.toMatchObject({ code: '23514' });
  }
});

test('A→B→A outcomes select the latest completed evidence without renewing the first-seen retention clock', async () => {
  const a = evaluationHistoryFixture();
  await save(a);
  const first = (await query('SELECT observed_at FROM automatic_evaluation_history')).rows[0].observed_at;
  const b = evaluationHistoryFixture(); b.cases.forEach(entry => { entry.gain = false; entry.regression = true; });
  await save(b);
  expect((await readEvaluationHistory(database())).groups[0]).toMatchObject({ gains: 0, regressions: 25 });
  await save(a);
  expect((await readEvaluationHistory(database())).groups[0]).toMatchObject({ gains: 25, regressions: 0 });
  expect((await query('SELECT observed_at FROM automatic_evaluation_history ORDER BY observed_at LIMIT 1')).rows[0].observed_at).toEqual(first);
  expect((await readEvaluationHistory(database())).windows).toBe(2);
});

test('gap changes deduplicate independently and recover without losing old failure observations', async () => {
  const missing = evaluationHistoryFixture({ status: 'misses' });
  await save(missing); await save(missing);
  const blocked = evaluationHistoryFixture({ status: 'unavailable', gap: 'evidence_unavailable' });
  await save(blocked);
  expect((await readEvaluationHistory(database())).groups[0].gaps.evidence_unavailable).toBe(25);
  await save(missing);
  expect((await readEvaluationHistory(database())).groups[0].gaps.cache_missing).toBe(25);
  expect((await readEvaluationHistory(database())).windows).toBe(2);
  await save(evaluationHistoryFixture());
  const recovered = await readEvaluationHistory(database());
  expect(recovered.windows).toBe(3);
  expect(recovered.groups[0]).toMatchObject({ paired: 25, gaps: { cache_missing: 0, evidence_unavailable: 0 } });
});

test('pair origins persist independently, deduplicate after restart, and summarize latest complete observations', async () => {
  const mixed = evaluationHistoryFixture();
  mixed.cases = mixed.cases.map((row, index) => evaluationHistoryCase(`mixed-${index}`, row.mediaType,
    [{ status: 'automatic', destinationId: 1 }, { status: 'proposed', destinationId: 2, latencyMs: 1, promptTokens: 1, outputTokens: 1 }], { libraryId: 2 }));
  await save(mixed);
  const readBack = (await query('SELECT result FROM automatic_evaluation_history')).rows[0].result;
  await save(readBack);
  expect(await readEvaluationHistory(database())).toMatchObject({ windows: 1, groups: [{ paired: 25, mixedPairs: 25, aiPairs: 0, deterministicPairs: 0 }] });
  const deterministic = structuredClone(mixed); deterministic.cases.forEach(row => { row.pairKind = 'deterministic'; });
  await save(deterministic);
  expect(await readEvaluationHistory(database())).toMatchObject({ windows: 2, groups: [{ mixedPairs: 0, deterministicPairs: 25, gains: 25 }] });
  // Same flags but a different origin is a distinct observation, not a key collision.
  await save(mixed);
  expect(await readEvaluationHistory(database())).toMatchObject({ windows: 2, groups: [{ mixedPairs: 25, deterministicPairs: 0 }] });
});

test('upgrade preserves v1 histories and migration is replay-safe without accepting unknown versions', async () => {
  const originalSql = await readFile(new URL('../../../../database/migrations/20260925_130000_add_automatic_evaluation_history.sql', import.meta.url), 'utf8');
  // Isolated suite database: start with the actual pre-upgrade table definition.
  await query('DROP TABLE automatic_evaluation_history');
  await query(originalSql);
  const legacy = evaluationHistoryFixture({ status: 'misses' });
  legacy.version = 'evaluation_history.v1';
  legacy.revision = adjudicationDigest([legacy.version, legacy.cohortRevision, legacy.evidenceRevision, legacy.modelRevision]);
  legacy.cases.forEach(entry => { delete entry.gaps; delete entry.pairKind; });
  await save(legacy);
  await expect(save(evaluationHistoryFixture())).rejects.toMatchObject({ code: '23514' });
  const sql = await readFile(new URL('../../../../database/migrations/20260925_140000_add_evaluation_coverage_gaps.sql', import.meta.url), 'utf8');
  await query(sql); await query(sql);
  await save(evaluationHistoryFixture({ version: 'evaluation_history.v2' }));
  await expect(save(evaluationHistoryFixture())).rejects.toMatchObject({ code: '23514' });
  const mixedSql = await readFile(new URL('../../../../database/migrations/20260925_150000_add_mixed_evaluation_history.sql', import.meta.url), 'utf8');
  await query(mixedSql); await query(mixedSql);
  await save(evaluationHistoryFixture());
  const report = await readEvaluationHistory(database());
  expect(report).toMatchObject({ windows: 3, revisions: 3 });
  expect(report.groups[0]).toMatchObject({ aiPairs: 25, legacyPairs: 0 });
  expect(report.groups[1]).toMatchObject({ legacyPairs: 25, aiPairs: 0 });
  expect(report.groups[2].gaps.unknown).toBe(25);
  await expect(query(`INSERT INTO automatic_evaluation_history VALUES($1,now(),now(),$2)`,
    ['f'.repeat(64), JSON.stringify({ ...legacy, version: 'unknown' })])).rejects.toMatchObject({ code: '23514' });
});
