/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import pg from 'pg';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { runAbortableDatabaseRead } from '../../utils/databaseAbortableRead.mjs';
import { createDatabaseReadCanceller } from '../../utils/databaseReadCancellation.mjs';
import { createEvidenceGapAuditRepository, READ_GAP_AUDIT_INPUT_SQL } from '../../services/evidenceGapAuditRepository.mjs';
import { readEvidenceGapAuditStatus } from '../../services/evidenceGapAuditStatus.mjs';
import { createAutomaticEvidenceGapAudit, EVIDENCE_GAP_AUDIT_LOCK } from '../../services/automaticEvidenceGapAudit.mjs';
import { runEvidenceGapAuditThread } from '../../services/evidenceGapAuditThreadClient.mjs';
import { resetEvidenceGapAuditForRestore } from '../../services/evidenceGapAuditRestore.mjs';
import { gapAuditRow } from '../fixtures/evidenceGapAuditFixture.mjs';

let db, repository, worker, libraryIds, historyId;
function read(callback, options) {
  const pool = getPool();
  return runAbortableDatabaseRead({ connect: () => pool.connect(), assertActive: () => {},
    cancelRead: createDatabaseReadCanceller({ createClient: () => new pg.Client({ ...pool.options,
      pipeline: false, connectionTimeoutMillis: 500, statement_timeout: 500, query_timeout: 750 }) }) }, callback, options);
}
beforeEach(async () => {
  const base = createIntegrationDatabaseModuleMock();
  db = { ...base, withTransaction: (callback, options) => options?.readOnly ? read(callback, options) : base.withTransaction(callback) };
  libraryIds = (await db.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES('Synthetic audit A','gap-audit-a','movie',true),('Synthetic audit B','gap-audit-b','movie',true) RETURNING id`)).rows.map(row => row.id);
  const capture = gapAuditRow().capture; capture.capturedAt = new Date(Date.now() - 60000).toISOString();
  capture.candidates.forEach((candidate, index) => { candidate.libraryId = libraryIds[index]; });
  capture.baselineLibraryId = libraryIds[0]; capture.combinedLibraryId = libraryIds[1];
  historyId = (await db.query(`INSERT INTO classification_history(title,tmdb_id,media_type,metadata,recorded_at,library_id)
    VALUES('Synthetic audit item',41,'movie',$1,$2,$3) RETURNING id`,
  [{ classification_details: { inventory_ranking_shadow: capture } }, capture.capturedAt, libraryIds[0]])).rows[0].id;
  repository = createEvidenceGapAuditRepository(db);
  worker = createAutomaticEvidenceGapAudit(db, { repository, withAdmission: (callback, { signal }) => callback(signal) });
});
afterEach(async () => {
  worker.stop();
  await db.query('DELETE FROM automatic_evidence_gap_audit');
  await db.query('DELETE FROM classification_history WHERE id=$1', [historyId]);
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraryIds]);
});
const status = () => readEvidenceGapAuditStatus(db);

test('independent job publishes a bounded aggregate, resumes cooldown and never rewrites source evidence', async () => {
  const before = (await db.query('SELECT * FROM classification_history WHERE id=$1', [historyId])).rows;
  expect(await status()).toMatchObject({ status: 'never_run', report: null });
  expect(await worker.run()).toEqual({ status: 'evaluated' });
  expect(await status()).toMatchObject({ status: 'complete', report: {
    comparisons: { inspected: 1, eligible: 0, exclusions: { awaitingOutcome: 1 } },
    intake: { recordedMovieTvEvents: 1, withoutRetainedComparison: 0 } } });
  expect(await worker.run()).toEqual({ status: 'cooldown' });
  const restarted = createAutomaticEvidenceGapAudit(db, { repository });
  expect(await restarted.run()).toEqual({ status: 'cooldown' }); restarted.stop();
  expect((await db.query('SELECT * FROM classification_history WHERE id=$1', [historyId])).rows).toEqual(before);
  expect(JSON.stringify(await status())).not.toMatch(/Synthetic|classification_id|queryHash|input_fingerprint/);
});
test('source reads use a repeatable-read snapshot even when a writer commits between the intake and capture queries', async () => {
  let changed = false;
  const coherent = createEvidenceGapAuditRepository({ ...db, withTransaction: (callback, options) => read(client => callback({ query: async (...args) => {
    const result = await client.query(...args);
    if (!changed && args[0].includes('AS recorded_movie_tv_events')) {
      changed = true; await db.query("UPDATE classification_history SET metadata='{}'::jsonb WHERE id=$1", [historyId]);
    }
    return result;
  } }), options) });
  expect((await coherent.readSnapshot()).inputs.rows).toHaveLength(1);
  expect(changed).toBe(true);
  expect((await repository.readSnapshot()).inputs.rows).toHaveLength(0);
});
test('the real abortable reader establishes isolation before any query, rejects writes and cancels active PostgreSQL work', async () => {
  const options = { signal: new AbortController().signal, readOnly: true, isolationLevel: 'repeatable_read' };
  expect(await read(async client => (await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation, options)).toBe('repeatable read');
  await expect(read(client => client.query('DELETE FROM automatic_evidence_gap_audit'), options)).rejects.toMatchObject({ code: '25006' });
  const controller = new AbortController();
  const pending = read(async client => {
    const timer = setTimeout(() => controller.abort(), 50);
    try { await client.query('SELECT pg_sleep(30)'); } finally { clearTimeout(timer); }
  }, { ...options, signal: controller.signal });
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect((await db.query('SELECT 1 AS ready')).rows[0].ready).toBe(1);
  expect(await status()).toMatchObject({ status: 'never_run' });
});
test('payload preflight withholds rows above its budget; the checkpoint fences older publication and clears counts on failure', async () => {
  const snapshot = await repository.readSnapshot();
  const tooLarge = (await db.query(READ_GAP_AUDIT_INPUT_SQL, [snapshot.inputs.window.since, snapshot.observedAt, 1])).rows;
  expect(tooLarge).toHaveLength(1); expect(tooLarge[0].input).toBeNull(); expect(tooLarge[0].captures).toBe(1);
  const result = await runEvidenceGapAuditThread(snapshot);
  expect(await repository.save(result.fingerprint, result.report, snapshot.observedAt)).toBe(true);
  const older = structuredClone(result.report);
  older.window.until = older.window.outcomesAsOf = new Date(Date.parse(snapshot.observedAt) - 1000).toISOString();
  older.window.since = new Date(Date.parse(older.window.until) - 30 * 86400000).toISOString();
  expect(await repository.save('a'.repeat(64), older, older.window.until)).toBe(false);
  for (let index = 0; index < 6; index++) await repository.fail('memory_pressure');
  expect(await status()).toMatchObject({ status: 'deferred', reason: 'memory_pressure', report: null });
  const stored = (await db.query('SELECT * FROM automatic_evidence_gap_audit')).rows[0];
  expect(stored.failure_count).toBe(5); expect(stored.report).toBeNull();
  expect(stored.next_check_at - stored.observed_at).toBe(60 * 60000);
});
test('separate owners cannot publish concurrently; restore reset rolls back with its caller', async () => {
  const owner = await getPool().connect();
  try {
    await owner.query('SELECT pg_advisory_lock($1)', [EVIDENCE_GAP_AUDIT_LOCK]);
    expect(await worker.run()).toEqual({ status: 'busy' });
  } finally { await owner.query('SELECT pg_advisory_unlock($1)', [EVIDENCE_GAP_AUDIT_LOCK]); owner.release(); }
  await worker.run();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN'); await resetEvidenceGapAuditForRestore(client);
    expect((await client.query('SELECT COUNT(*)::int AS count FROM automatic_evidence_gap_audit')).rows[0].count).toBe(0);
    await client.query('ROLLBACK');
    expect(await status()).toMatchObject({ status: 'complete' });
    await client.query('BEGIN'); await resetEvidenceGapAuditForRestore(client); await client.query('COMMIT');
    expect(await status()).toMatchObject({ status: 'never_run', report: null });
  } finally { client.release(); }
});
