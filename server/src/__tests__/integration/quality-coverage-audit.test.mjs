/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getPool } from './setup.mjs';
import { qualitySnapshot } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { createQualityEvidenceRepository } from '../../services/qualityEvidenceRepository.mjs';
import { readQualityCoverageAudit } from '../../services/qualityCoverageAuditRepository.mjs';
import { readPrivateStudyJsonFile } from '../../scripts/privateStudyFileBoundary.mjs';

const database = { withTransaction: async callback => {
  const client = await getPool().connect();
  try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
} };
let protocol;
beforeEach(async () => {
  await getPool().query('TRUNCATE quality_evidence_study, cached_adjudication_batch, automatic_source_pair_evaluation, adjudication_capture_budget');
  const snapshot = qualitySnapshot(); snapshot.observedAt = new Date().toISOString();
  protocol = prepareSourcePairQualityProtocol(snapshot).protocol;
});
const snapshotRows = async () => (await getPool().query(`SELECT
  (SELECT jsonb_agg(row_to_json(s)) FROM quality_evidence_study s) AS study,
  (SELECT jsonb_agg(row_to_json(b)) FROM adjudication_capture_budget b) AS budget,
  (SELECT jsonb_agg(row_to_json(e)) FROM automatic_source_pair_evaluation e) AS evaluation,
  (SELECT jsonb_agg(row_to_json(c)) FROM cached_adjudication_batch c) AS cache`)).rows;

test('installed but unused schema is reported without seeding or pruning any rows', async () => {
  const before = await snapshotRows(), result = await readQualityCoverageAudit(database);
  expect(result).toMatchObject({ status: 'study_not_started', captureDailyCalls: 0, quality: null,
    capabilities: { study: true, cache: true, evaluation: true, budget: true }, cache: { state: 'missing', responses: null } });
  expect(await snapshotRows()).toEqual(before);
});

test('active evidence remains unchanged; audit really runs in repeatable-read/read-only with timeouts', async () => {
  await createQualityEvidenceRepository(database).start(protocol);
  const before = await snapshotRows();
  const observed = await readQualityCoverageAudit({ withTransaction: fn => database.withTransaction(async client => {
    const result = await fn(client);
    const { rows: [settings] } = await client.query(`SELECT current_setting('transaction_isolation') AS isolation,
      current_setting('transaction_read_only') AS read_only, current_setting('statement_timeout') AS statement,
      current_setting('lock_timeout') AS lock, current_setting('transaction_timeout') AS transaction`);
    expect(settings).toEqual({ isolation: 'repeatable read', read_only: 'on', statement: '5s', lock: '1s', transaction: '15s' });
    return result;
  }) });
  expect(observed).toMatchObject({ status: 'blocked_evidence', coverage: { total: { sampled: 48, blocked: 48 } },
    quality: { limits: { independenceVerified: false } } });
  expect(await snapshotRows()).toEqual(before);
});

test('database rejects writes even if accidentally introduced after audit reads', async () => {
  await createQualityEvidenceRepository(database).start(protocol); const before = await snapshotRows();
  await expect(readQualityCoverageAudit({ withTransaction: fn => database.withTransaction(async client => {
    await fn(client); await client.query('DELETE FROM quality_evidence_study');
  }) })).rejects.toMatchObject({ code: '25006' });
  expect(await snapshotRows()).toEqual(before);
});

test('a partial upgrade is detected before querying missing columns', async () => {
  await getPool().query('ALTER TABLE quality_evidence_study RENAME COLUMN evidence TO audit_missing_evidence');
  try {
    expect(await readQualityCoverageAudit(database)).toMatchObject({ status: 'upgrade_required', studyState: 'unavailable',
      capabilities: { study: false, cache: true, evaluation: true, budget: true }, quality: null, cache: null });
  } finally { await getPool().query('ALTER TABLE quality_evidence_study RENAME COLUMN audit_missing_evidence TO evidence'); }
});

test('an absent table is detected without attempting a migration', async () => {
  await getPool().query('ALTER TABLE quality_evidence_study RENAME TO quality_evidence_study_audit_old');
  try {
    expect(await readQualityCoverageAudit(database)).toMatchObject({ status: 'upgrade_required', capabilities: { study: false } });
    expect((await getPool().query("SELECT to_regclass('public.quality_evidence_study') AS name")).rows[0].name).toBeNull();
  } finally { await getPool().query('ALTER TABLE quality_evidence_study_audit_old RENAME TO quality_evidence_study'); }
});

test('cancellation preserves study and budget state', async () => {
  await createQualityEvidenceRepository(database).start(protocol); const before = await snapshotRows();
  await expect(readQualityCoverageAudit(database, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
  expect(await snapshotRows()).toEqual(before);
});

test('all reads share a snapshot even when another connection changes the budget', async () => {
  await getPool().query('INSERT INTO adjudication_capture_budget(singleton) VALUES(true)');
  const result = await readQualityCoverageAudit({ withTransaction: fn => database.withTransaction(client => fn({ query: async (sql, params) => {
    const rows = await client.query(sql, params);
    if (sql.startsWith('SELECT transaction_timestamp')) {
      // Simulates an independent concurrent operator write, not a write by the audit.
      await getPool().query('UPDATE adjudication_capture_budget SET daily_calls=20,daily_tokens=168960');
    }
    return rows;
  } })) });
  expect(result.captureDailyCalls).toBe(0);
  expect((await getPool().query('SELECT daily_calls FROM adjudication_capture_budget')).rows[0].daily_calls).toBe(20);
});

test('real CLI returns exit 2 for a valid incomplete audit and never overwrites its artifact', async () => {
  const connection = getPool().options, path = `.tmp/quality-audit-cli-${randomUUID()}.json`;
  const env = { ...process.env, NODE_ENV: 'test', POSTGRES_HOST: connection.host, POSTGRES_PORT: String(connection.port),
    POSTGRES_DB: connection.database, POSTGRES_USER: connection.user, POSTGRES_PASSWORD: connection.password };
  const script = fileURLToPath(new URL('../../scripts/runQualityEvidenceStudy.mjs', import.meta.url));
  const execute = () => promisify(execFile)(process.execPath, [script, '--audit', '--output-file', path], { env, timeout: 30000 });
  const before = await snapshotRows();
  const failure = await execute().catch(error => error);
  expect(failure.code).toBe(2); expect(failure.stderr).toBe('');
  expect(JSON.parse(failure.stdout)).toMatchObject({ operation: 'audit', status: 'study_not_started', databaseWrites: 0, providerCalls: 0 });
  const artifact = await readPrivateStudyJsonFile(path);
  expect(artifact.status).toBe('study_not_started');
  await expect(execute()).rejects.toMatchObject({ code: 1, stdout: '', stderr: 'Quality study did not complete. No routing changes were made.\n' });
  expect(await readPrivateStudyJsonFile(path)).toEqual(artifact);
  expect(await snapshotRows()).toEqual(before);
});
