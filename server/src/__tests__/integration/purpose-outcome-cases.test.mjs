/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getPool } from './setup.mjs';
import { livePurposeEvaluationFixture } from '../fixtures/purposeOutcomeFixture.mjs';
import { recordFeedbackSource } from '../../services/feedbackSourceReceipt.mjs';
import { runAbortableDatabaseRead } from '../../utils/databaseAbortableRead.mjs';
import { createDatabaseReadCanceller } from '../../utils/databaseReadCancellation.mjs';
import { runInventoryOutcomeCalibration } from '../../scripts/runInventoryOutcomeCalibration.mjs';

let libraries, history;
const read = (callback, options) => {
  const pool = getPool();
  return runAbortableDatabaseRead({ connect: () => pool.connect(), assertActive: () => {},
    cancelRead: createDatabaseReadCanceller({ createClient: () => new pg.Client({ ...pool.options,
      pipeline: false, connectionTimeoutMillis: 500, statement_timeout: 500, query_timeout: 750 }) }) }, callback, options);
};
const execute = (withTransaction = read, signal) => runInventoryOutcomeCalibration({ argv: ['--prospective-purpose-cases'], signal,
  load: async () => ({ withTransaction, close: async () => {} }) });
beforeAll(async () => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    libraries = (await client.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
      VALUES('PRIVATE ORIGINAL','purpose-case-original','movie',true),('PRIVATE POLICY','purpose-case-policy','movie',true) RETURNING id`)).rows.map(row => row.id);
    history = (await client.query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,method,library_id)
      VALUES(9223372036854775807,'PRIVATE TITLE',42,'movie','completed','ai_analysis',$1) RETURNING *`, [libraries[0]])).rows[0];
    const payload = structuredClone(livePurposeEvaluationFixture({ libraryId: libraries[1] }).capture.payload);
    payload.capturedAt = new Date(Date.now() - 60000).toISOString();
    await client.query(`INSERT INTO classification_policy_evaluation_captures
      (classification_id,capture_version,media_type,identity_key,observed_at,expires_at,reason_id,payload)
      VALUES($1,2,'movie','movie:42',$2,$2::timestamptz+INTERVAL '720 hours','complete',$3)`, [history.id, payload.capturedAt, payload]);
    const feedbackId = (await client.query('INSERT INTO policy_feedback_log(tmdb_id) VALUES(42) RETURNING id')).rows[0].id;
    const reviewId = randomUUID(), fingerprint = 'a'.repeat(64), now = new Date();
    const snapshot = { version: 'classification.feedback_outcome.v3', classificationId: String(history.id), mediaType: 'movie', tmdbId: 42,
      selectedLibraryId: libraries[1], decisionContext: null, action: 'correction', intake: 'standalone', reference: {
        kind: 'original_automated_destination', libraryId: libraries[0], reviewId, actorFingerprint: fingerprint,
        sourceVersion: 'b'.repeat(64), issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 600000).toISOString() } };
    await recordFeedbackSource(client, { classificationId: String(history.id), feedbackId, intake: 'standalone', fingerprint,
      classification: history, selectedLibraryId: libraries[1], reviewEvidence: { snapshot, reviewId, actorFingerprint: fingerprint } });
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});
// The suite database is disposable; append-only receipts are never deleted for cleanup.

test('real source query keeps BIGINT History original proof, read-only isolation and unchanged source/checkpoint state', async () => {
  const db = getPool(), before = (await db.query('SELECT * FROM classification_history')).rows;
  const receipts = (await db.query('SELECT * FROM policy_feedback_sources')).rows;
  const checkpoint = (await db.query('SELECT * FROM automatic_evidence_gap_audit')).rows;
  const result = await execute((callback, options) => read(async client => {
    expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
    expect((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
    return callback(client);
  }, options));
  expect(result.cases[0]).toMatchObject({ classificationId: String(history.id),
    source: { kind: 'history_review', referenceKind: 'feedback_receipt', id: String(history.id) },
    original: { status: 'available', libraryId: libraries[0], evidenceKind: 'history_review_original_reference', method: null },
    policy: { libraryId: libraries[1] }, assessment: { libraryId: libraries[1] },
    comparisons: { policyVersusChoice: 'agrees', originalVersusChoice: 'differs', policyVersusOriginal: 'differs' } });
  expect(result.evaluation.sampleSize).toBe(1);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|actorFingerprint|sourceVersion|reviewId|event_key|snapshot/);
  expect((await db.query('SELECT * FROM classification_history')).rows).toEqual(before);
  expect((await db.query('SELECT * FROM policy_feedback_sources')).rows).toEqual(receipts);
  expect((await db.query('SELECT * FROM automatic_evidence_gap_audit')).rows).toEqual(checkpoint);
  await expect(execute((callback, options) => read(client => callback({ query: sql => sql.includes('transaction_timestamp')
    ? client.query('DELETE FROM automatic_evidence_gap_audit') : client.query(sql) }), options))).rejects.toMatchObject({ code: '25006' });
});

test('one snapshot keeps target admission coherent while later reads see the committed change', async () => {
  let changed = false;
  try {
    const result = await execute((callback, options) => read(client => callback({ query: async (...args) => {
      const value = await client.query(...args);
      if (!changed && args[0].startsWith('SELECT date_trunc')) {
        changed = true; await getPool().query('UPDATE libraries SET is_active=false WHERE id=$1', [libraries[1]]);
      }
      return value;
    } }), options));
    expect(changed).toBe(true); expect(result.evaluation.sampleSize).toBe(1);
    const later = await execute(); expect(later.cases).toEqual([]);
    expect(later.evaluation.coverage.gaps.unavailable_destination).toBe(1);
  } finally { await getPool().query('UPDATE libraries SET is_active=true WHERE id=$1', [libraries[1]]); }
  await getPool().query("UPDATE classification_history SET library_id=$1,metadata='{}',method='manual_correction' WHERE id=$2", [libraries[1], history.id]);
  expect((await execute()).cases[0].original.libraryId).toBe(libraries[0]);
});

test('real CLI emits one quiet bounded private JSON document', () => {
  const connection = getPool().options;
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/runInventoryOutcomeCalibration.mjs', import.meta.url)),
    '--prospective-purpose-cases'], { encoding: 'utf8', timeout: 20000, env: { ...process.env,
    POSTGRES_HOST: connection.host, POSTGRES_PORT: String(connection.port), POSTGRES_DB: connection.database,
    POSTGRES_USER: connection.user, POSTGRES_PASSWORD: connection.password,
    POSTGRES_CONN_TIMEOUT_MS: '1000', PGOPTIONS: '', LOG_LEVEL: 'debug', FILE_LOGGING_ENABLED: 'false' } });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ version: 'policy.purpose_outcome_cases.v1', private: true, display: { shownCases: 1 } });
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(1048576);
  expect(result.stdout).not.toMatch(/PRIVATE|Fingerprint|password|SLOW QUERY/);
});

test('cancellation stops active work without leaving a busy database connection', async () => {
  const controller = new AbortController();
  await expect(execute((callback, options) => read(client => callback({ query: async (...args) => {
    if (args[0].startsWith('WITH authorized')) {
      const timer = setTimeout(() => controller.abort(), 50);
      try { return await client.query('SELECT pg_sleep(30)'); } finally { clearTimeout(timer); }
    }
    return client.query(...args);
  } }), options), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect((await getPool().query('SELECT 1 AS ready')).rows[0].ready).toBe(1);
});
