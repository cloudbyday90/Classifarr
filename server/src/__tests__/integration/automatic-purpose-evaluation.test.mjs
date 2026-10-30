/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { runAbortableDatabaseRead } from '../../utils/databaseAbortableRead.mjs';
import { createDatabaseReadCanceller } from '../../utils/databaseReadCancellation.mjs';
import { createPurposeEvaluationRepository } from '../../services/purposeEvaluationRepository.mjs';
import { readPurposeEvaluationStatus } from '../../services/purposeEvaluationStatus.mjs';
import { createAutomaticPurposeEvaluation, PURPOSE_EVALUATION_LOCK } from '../../services/automaticPurposeEvaluation.mjs';
import { runPurposeEvaluationThread } from '../../services/purposeEvaluationThreadClient.mjs';
import { resetPurposeEvaluationForRestore } from '../../services/purposeEvaluationRestore.mjs';
import { livePurposeEvaluationFixture } from '../fixtures/purposeOutcomeFixture.mjs';
import { recordFeedbackSource } from '../../services/feedbackSourceReceipt.mjs';
import { readBackupConfiguration } from '../../services/backupExportCatalog.mjs';

let db, repository, worker, libraries, historyId, itemId = 41;
function read(callback, options) {
  const pool = getPool();
  return runAbortableDatabaseRead({ connect: () => pool.connect(), assertActive: () => {},
    cancelRead: createDatabaseReadCanceller({ createClient: () => new pg.Client({ ...pool.options,
      pipeline: false, connectionTimeoutMillis: 500, statement_timeout: 500, query_timeout: 750 }) }) }, callback, options);
}
beforeEach(async () => {
  const base = createIntegrationDatabaseModuleMock();
  itemId++;
  db = { ...base, withTransaction: (callback, options) => options?.readOnly ? read(callback, options) : base.withTransaction(callback) };
  await db.withTransaction(async client => {
    libraries = (await client.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
      VALUES('PRIVATE ORIGINAL','auto-purpose-original','movie',true),('PRIVATE POLICY','auto-purpose-policy','movie',true) RETURNING id`)).rows.map(row => row.id);
    const history = (await client.query(`INSERT INTO classification_history(title,tmdb_id,media_type,status,method,library_id)
      VALUES('PRIVATE TITLE',$2,'movie','completed','ai_analysis',$1) RETURNING *`, [libraries[0], itemId])).rows[0];
    historyId = history.id;
    const payload = structuredClone(livePurposeEvaluationFixture({ libraryId: libraries[1], tmdbId: itemId }).capture.payload);
    payload.capturedAt = new Date(Date.now() - 60000).toISOString();
    await client.query(`INSERT INTO classification_policy_evaluation_captures
      (classification_id,capture_version,media_type,identity_key,observed_at,expires_at,reason_id,payload)
      VALUES($1,2,'movie',$4,$2,$2::timestamptz+INTERVAL '720 hours','complete',$3)`, [historyId, payload.capturedAt, payload, `movie:${itemId}`]);
    const feedbackId = (await client.query('INSERT INTO policy_feedback_log(tmdb_id) VALUES($1) RETURNING id', [itemId])).rows[0].id;
    const reviewId = randomUUID(), fingerprint = 'a'.repeat(64), now = new Date();
    const snapshot = { version: 'classification.feedback_outcome.v3', classificationId: String(historyId), mediaType: 'movie', tmdbId: itemId,
      selectedLibraryId: libraries[1], decisionContext: null, action: 'correction', intake: 'standalone', reference: {
        kind: 'original_automated_destination', libraryId: libraries[0], reviewId, actorFingerprint: fingerprint, sourceVersion: 'b'.repeat(64),
        issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 600000).toISOString() } };
    await recordFeedbackSource(client, { classificationId: String(historyId), feedbackId, intake: 'standalone', fingerprint,
      classification: history, selectedLibraryId: libraries[1], reviewEvidence: { snapshot, reviewId, actorFingerprint: fingerprint } });
  });
  repository = createPurposeEvaluationRepository(db);
  worker = createAutomaticPurposeEvaluation(db, { repository, withAdmission: (callback, { signal }) => callback(signal) });
});
afterEach(async () => {
  worker.stop(); await db.query('DELETE FROM automatic_purpose_evaluation');
  await db.query('DELETE FROM classification_history WHERE id=$1', [historyId]);
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraries]);
});
const status = () => readPurposeEvaluationStatus(db);

test('scheduled worker publishes only aggregate counts, resumes cooldown and preserves all source evidence', async () => {
  const before = (await db.query('SELECT * FROM classification_history')).rows;
  const sources = (await db.query('SELECT * FROM policy_purpose_outcome_supplements')).rows;
  expect((await status()).status).toBe('never_run');
  expect(await worker.run()).toEqual({ status: 'evaluated' });
  expect(await status()).toMatchObject({ status: 'complete', report: { eligible: 1, comparisons: {
    policyVersusChoice: { agrees: 1, differs: 0 }, originalVersusChoice: { agrees: 0, differs: 1 } } } });
  expect(await worker.run()).toEqual({ status: 'cooldown' });
  const restarted = createAutomaticPurposeEvaluation(db, { repository });
  expect(await restarted.run()).toEqual({ status: 'cooldown' }); restarted.stop();
  expect((await db.query('SELECT * FROM classification_history')).rows).toEqual(before);
  expect((await db.query('SELECT * FROM policy_purpose_outcome_supplements')).rows).toEqual(sources);
  expect(JSON.stringify(await status())).not.toMatch(/PRIVATE|classificationId|identityKey|input_fingerprint|actor|tmdbId|libraryId/);
  expect(JSON.stringify(await readBackupConfiguration(db))).not.toContain('automatic_purpose_evaluation');
});
test('snapshot stays coherent across a committed cascade after the capability probe', async () => {
  let deleted = false;
  const coherent = createPurposeEvaluationRepository({ ...db, withTransaction: (callback, options) => read(client => callback({ query: async (...args) => {
    const result = await client.query(...args);
    if (!deleted && args[0].includes('bool_and')) { deleted = true; await db.query('DELETE FROM classification_history WHERE id=$1', [historyId]); }
    return result;
  } }), options) });
  const bound = (await coherent.readSnapshot()).inputs.rows.find(row => row.classification_id === String(historyId));
  expect(bound.holdout_identity).toBe(`movie:${itemId}`); expect(bound.supplement).not.toBeNull();
  const later = await repository.readSnapshot(), retained = later.inputs.rows.find(row => row.classification_id === String(historyId));
  // Feedback receipts survive History deletion; absence of the child is a gap, never an empty-source success.
  expect(retained.holdout_identity).toBeNull(); expect(retained.supplement).toBeNull();
  expect((await runPurposeEvaluationThread(later)).report.phase).toBe('no_eligible_choices');
});
test('stale publication cannot overwrite newer state; failure backoff clears counts and bounds delay', async () => {
  const snapshot = await repository.readSnapshot(), result = await runPurposeEvaluationThread(snapshot);
  expect(await repository.save(result.fingerprint, result.report, snapshot.observedAt)).toBe(true);
  const old = structuredClone(result.report); old.window.until = new Date(Date.parse(old.window.until) - 1000).toISOString();
  old.window.since = new Date(Date.parse(old.window.until) - 30 * 86400000).toISOString();
  expect(await repository.save('a'.repeat(64), old, old.window.until)).toBe(false);
  for (let n = 0; n < 6; n++) await repository.fail('memory_pressure');
  expect(await status()).toMatchObject({ status: 'deferred', reason: 'memory_pressure', report: null });
  const stored = (await db.query('SELECT * FROM automatic_purpose_evaluation')).rows[0];
  expect(stored.failure_count).toBe(5); expect(stored.next_check_at - stored.observed_at).toBe(60 * 60000);
  await repository.fail('sources_unavailable'); expect((await status()).status).toBe('unavailable');
});
test('cross-process ownership and transactional restore reset preserve checkpoint lifecycle', async () => {
  const owner = await getPool().connect();
  try {
    await owner.query('SELECT pg_advisory_lock($1)', [PURPOSE_EVALUATION_LOCK]);
    expect(await worker.run()).toEqual({ status: 'busy' });
  } finally { await owner.query('SELECT pg_advisory_unlock($1)', [PURPOSE_EVALUATION_LOCK]); owner.release(); }
  await worker.run(); const client = await getPool().connect();
  try {
    await client.query('BEGIN'); await resetPurposeEvaluationForRestore(client); await client.query('ROLLBACK');
    expect((await status()).status).toBe('complete');
    await client.query('BEGIN'); await resetPurposeEvaluationForRestore(client); await client.query('COMMIT');
    expect((await status()).status).toBe('never_run');
  } finally { client.release(); }
});
test('real source and status reads reject writes and cancel active SQL without publishing counts', async () => {
  const options = { signal: new AbortController().signal, readOnly: true, isolationLevel: 'repeatable_read' };
  await expect(read(client => client.query('DELETE FROM automatic_purpose_evaluation'), options)).rejects.toMatchObject({ code: '25006' });
  const controller = new AbortController();
  const cancelled = createPurposeEvaluationRepository({ ...db, withTransaction: (callback, config) => read(client => callback({ query: async (...args) => {
    if (args[0].startsWith('WITH authorized')) {
      const timer = setTimeout(() => controller.abort(), 50);
      try { return await client.query('SELECT pg_sleep(30)'); } finally { clearTimeout(timer); }
    }
    return client.query(...args);
  } }), config) });
  await expect(cancelled.readSnapshot(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect((await status()).status).toBe('never_run'); expect((await db.query('SELECT 1 AS ready')).rows[0].ready).toBe(1);
});
