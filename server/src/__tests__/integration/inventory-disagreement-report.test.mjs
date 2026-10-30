/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, beforeEach, test, expect } from '@jest/globals';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getPool } from './setup.mjs';
import { runAbortableDatabaseRead } from '../../utils/databaseAbortableRead.mjs';
import { createDatabaseReadCanceller } from '../../utils/databaseReadCancellation.mjs';
import { runInventoryOutcomeCalibration } from '../../scripts/runInventoryOutcomeCalibration.mjs';
import { READ_INVENTORY_PROSPECTIVE_INPUT_SQL } from '../../services/inventoryProspectiveSnapshot.mjs';
import { inventoryRankingShadowFixture } from '../fixtures/inventoryRankingShadowFixture.mjs';
import { mintPolicyEvaluationFixture } from '../fixtures/policyEvaluationCaptureFixture.mjs';

let libraries, historyId, fixtureMetadata;
const read = (callback, options) => {
  const pool = getPool();
  return runAbortableDatabaseRead({ connect: () => pool.connect(), assertActive: () => {},
    cancelRead: createDatabaseReadCanceller({ createClient: () => new pg.Client({ ...pool.options,
      pipeline: false, connectionTimeoutMillis: 500, statement_timeout: 500, query_timeout: 750 }) }) }, callback, options);
};
const execute = (withTransaction = read, signal) => runInventoryOutcomeCalibration({ argv: ['--prospective-disagreements'], signal,
  load: async () => ({ withTransaction, close: async () => {} }) });
beforeAll(async () => {
  const db = getPool();
  libraries = (await db.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES('Private disagreement A','disagreement-a','movie',true),('Private disagreement B','disagreement-b','movie',true) RETURNING id`)).rows.map(row => row.id);
  const capture = structuredClone(inventoryRankingShadowFixture('movie', 42).capture);
  capture.capturedAt = new Date(Date.now() - 60000).toISOString();
  capture.candidates.forEach((candidate, index) => { candidate.libraryId = libraries[index]; });
  capture.baselineLibraryId = libraries[0]; capture.combinedLibraryId = libraries[1];
  fixtureMetadata = { classification_details: { inventory_ranking_shadow: capture } };
  historyId = String((await db.query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,metadata,recorded_at,library_id)
    VALUES(9223372036854775807,'Private disagreement title',42,'movie',$1,$2,$3) RETURNING id`,
  [fixtureMetadata, capture.capturedAt, libraries[0]])).rows[0].id);
  const policyCapture = structuredClone(mintPolicyEvaluationFixture(undefined, { libraryId: libraries[0] }).capture.payload);
  policyCapture.capturedAt = new Date(Date.parse(capture.capturedAt) - 1000).toISOString();
  await db.query(`INSERT INTO classification_policy_evaluation_captures
    (classification_id,media_type,identity_key,observed_at,expires_at,reason_id,payload,capture_version)
    VALUES($1,'movie','movie:42',$2,$2::timestamptz+INTERVAL '720 hours','complete',$3,2)`,
  [historyId, policyCapture.capturedAt, policyCapture]);
  const receipt = (await db.query(`INSERT INTO policy_authorized_outcome_source_event_receipts
    (source_id,source_event_id,command_fingerprint,classification_id,destination_library_id,final_outcome_status_id,persistence_status_id)
    VALUES('operator_confirmation',$1,$2,$3,$4,'resolved','outcome_only') RETURNING id`,
  [`runtime_destination_evidence:${historyId}:${'a'.repeat(22)}:${'b'.repeat(22)}`, 'c'.repeat(64), historyId, libraries[1]])).rows[0];
  await db.query(`INSERT INTO policy_authorized_outcome_evaluation_snapshots
    (receipt_id,event_key,media_type,identity_key,selected_library_id,action_kind,observed_at)
    SELECT id,$1,'movie','movie:42',$2,'correction',created_at FROM policy_authorized_outcome_source_event_receipts WHERE id=$3`,
  [`runtime_resolution:${historyId}:${'a'.repeat(22)}`, libraries[1], receipt.id]);
});
beforeEach(async () => {
  await getPool().query('UPDATE classification_history SET metadata=$1 WHERE id=$2', [fixtureMetadata, historyId]);
});
// Canonical receipts remain append-only. The harness drops this entire disposable suite database.

test('real private CLI read keeps exact IDs, leaves source/checkpoint state unchanged and rejects injected DML', async () => {
  const db = getPool(), before = (await db.query('SELECT * FROM classification_history WHERE id=$1', [historyId])).rows;
  const checkpoint = (await db.query('SELECT * FROM automatic_evidence_gap_audit')).rows;
  const report = await execute(async (callback, options) => read(async client => {
    expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
    expect((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
    return callback(client);
  }, options));
  expect(report.cases[0]).toMatchObject({ classificationId: historyId, assessment: { libraryId: libraries[1] }, original: { status: 'unavailable' } });
  expect(report.cases[0].policyEvaluation).toMatchObject({ status: 'available', reference: 'retained_policy_evaluation',
    candidates: [{ policyId: 10, libraryId: libraries[0], purposeProvenance: 'declared_native' }] });
  expect(JSON.stringify(report)).not.toMatch(/Private|queryHash|snapshotId|event_key|Fingerprint/);
  expect((await db.query('SELECT * FROM classification_history WHERE id=$1', [historyId])).rows).toEqual(before);
  expect((await db.query('SELECT * FROM automatic_evidence_gap_audit')).rows).toEqual(checkpoint);
  await expect(execute((callback, options) => read(client => callback({ query: sql => sql.includes('transaction_timestamp')
    ? client.query('DELETE FROM automatic_evidence_gap_audit') : client.query(sql) }), options))).rejects.toMatchObject({ code: '25006' });
});

test('capture and activity reads remain coherent across a committed source change', async () => {
  let changed = false;
  const report = await execute((callback, options) => read(client => callback({ query: async (...args) => {
    const result = await client.query(...args);
    if (!changed && args[0].includes('AS recorded_movie_tv_events')) {
      changed = true; await getPool().query("UPDATE classification_history SET metadata='{}' WHERE id=$1", [historyId]);
    }
    return result;
  } }), options));
  expect(report.evaluation.sampleSize).toBe(1); expect(changed).toBe(true);
  expect((await execute()).evaluation.sampleSize).toBe(0);
});

test('the real CLI process emits one private JSON document with quiet database logging', () => {
  const connection = getPool().options;
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/runInventoryOutcomeCalibration.mjs', import.meta.url)),
    '--prospective-disagreements'], { encoding: 'utf8', timeout: 20000, env: { ...process.env,
    POSTGRES_HOST: connection.host, POSTGRES_PORT: String(connection.port), POSTGRES_DB: connection.database,
    POSTGRES_USER: connection.user, POSTGRES_PASSWORD: connection.password,
    POSTGRES_CONN_TIMEOUT_MS: '1000', PGOPTIONS: '', LOG_LEVEL: 'debug', FILE_LOGGING_ENABLED: 'false' } });
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report).toMatchObject({ version: 'inventory_prospective_disagreements.v2', private: true });
  expect(report.cases[0].classificationId).toBe(historyId);
  expect(result.stdout).not.toMatch(/Private disagreement|queryHash|snapshotId|Fingerprint|password|SLOW QUERY/);
});

test('payload preflight withholds private rows; cancellation cleans active database work', async () => {
  const report = await execute();
  const rows = (await getPool().query(READ_INVENTORY_PROSPECTIVE_INPUT_SQL, [report.window.since, report.window.until, 1])).rows;
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ input: null, captures: 1 });
  const controller = new AbortController();
  await expect(execute((callback, options) => read(client => callback({ query: async (...args) => {
    if (args[0].includes('AS payload_bytes')) {
      const timer = setTimeout(() => controller.abort(), 50);
      try { return await client.query('SELECT pg_sleep(30)'); } finally { clearTimeout(timer); }
    }
    return client.query(...args);
  } }), options), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect((await getPool().query('SELECT 1 AS ready')).rows[0].ready).toBe(1);
});
