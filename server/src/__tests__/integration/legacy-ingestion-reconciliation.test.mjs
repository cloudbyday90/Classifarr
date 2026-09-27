/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { withSourcePageFixtures } from '../helpers/sourcePageFixture.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../services/contentTypeAnalyzer.mjs', () => ({ contentTypeAnalyzer: { analyze: async () => ({ analyzed: false }) } }));
const { createLegacyIngestionService } = await import('../../services/legacyIngestionService.mjs');
const { createMediaSyncOwnership } = await import('../../services/mediaSyncOwnership.mjs');
const { MediaSourceObservationStore } = await import('../../services/mediaSourceObservationStore.mjs');
const { MediaSyncService } = await import('../../services/mediaSync.mjs');
const { LIBRARY_INGESTION_WATCHDOG_SQL, LIBRARY_INGESTION_STATUS_SQL } = await import('../../services/libraryIngestionStatus.mjs');
const { readInventoryBackgroundReadiness } = await import('../../services/inventoryBackgroundReadiness.mjs');
const db = createIntegrationDatabaseModuleMock(), service = createLegacyIngestionService(db);
let libraryId, serverId, actorId, syncId;
const read = () => service.preview(actorId, libraryId);
const confirm = async (preview, requestId = randomUUID()) => service.confirm(actorId, libraryId, { requestId, workersStopped: true }, preview.revision);
const statuses = async () => (await db.query('SELECT id,status FROM media_server_sync_status WHERE library_id=$1 ORDER BY id', [libraryId])).rows;
beforeEach(async () => {
  actorId = (await db.query("INSERT INTO users(username,password_hash,role,is_active) VALUES ($1,'synthetic','admin',true) RETURNING id", [randomUUID()])).rows[0].id;
  serverId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://synthetic.invalid','synthetic') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,$1,'movie',$2,false) RETURNING id", [randomUUID(), serverId])).rows[0].id;
  syncId = (await db.query("INSERT INTO media_server_sync_status(media_server_id,library_id,sync_type,status,items_processed) VALUES ($1,$2,'full','running',7) RETURNING id", [serverId, libraryId])).rows[0].id;
  await createMediaSyncOwnership(db)(libraryId,
    () => new MediaSourceObservationStore().start(serverId, libraryId, { source: 'local_capture' }));
  await db.query("INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,tmdb_id) VALUES ($1,$2,'old','Synthetic','movie',77)", [serverId, libraryId]);
});
afterEach(async () => {
  await db.query('DELETE FROM audit_log WHERE user_id=$1', [actorId]);
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM media_server_sync_status WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
  await db.query('DELETE FROM users WHERE id=$1', [actorId]);
});

test('preview is read-only; confirmation is audited, idempotent, preserves data and leaves replay disabled', async () => {
  const preview = await read();
  expect(preview).toMatchObject({ canReconcile: true, capture: { source: 'local_capture' }, syncs: [{ id: syncId, processed: 7 }] });
  expect((await db.query('SELECT count(*)::int AS n FROM library_ingestion_state WHERE library_id=$1', [libraryId])).rows[0].n).toBe(0);
  expect(await statuses()).toEqual([{ id: syncId, status: 'running' }]);
  const requestId = randomUUID(), result = await confirm(preview, requestId);
  expect(result).toMatchObject({ repeated: false, receipt: { libraryId, requestId, status: 'reconciled' } });
  expect(await confirm(preview, requestId)).toMatchObject({ repeated: true, receipt: result.receipt });
  expect(await service.receipt(actorId, libraryId, requestId)).toMatchObject({ status: 'reconciled', receipt: result.receipt });
  expect((await db.query('SELECT count(*)::int AS n FROM audit_log WHERE user_id=$1', [actorId])).rows[0].n).toBe(1);
  expect(await statuses()).toEqual([{ id: syncId, status: 'failed' }]);
  expect((await db.query('SELECT external_id FROM media_server_items WHERE library_id=$1', [libraryId])).rows).toEqual([{ external_id: 'old' }]);
  expect((await db.query('SELECT is_active FROM libraries WHERE id=$1', [libraryId])).rows[0].is_active).toBe(false);
  expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).not.toContain(libraryId);
  expect((await read()).reason).toBe('not_needed');
  // Re-enable is a separate explicit action. Only full replay authorizes pruning/completion.
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
  expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).toContain(libraryId);
  const sync = new MediaSyncService({ mediaServerServices: { getMediaServerService: async () => withSourcePageFixtures({
    getLibraryItems: async () => [{ external_id: 'new', tmdb_id: 88, media_type: 'movie', title: 'Synthetic' }], getCollections: async () => [],
  }) }, skipReporter: { report: async () => {} } });
  expect(await sync.syncLibrary(libraryId, { incremental: true })).toMatchObject({ success: true, prunedItems: 1 });
  expect(await readInventoryBackgroundReadiness(db)).toBe('ready');
});

test('active owners are not stolen, even with stopped-worker attestation', async () => {
  const preview = await read(), own = createMediaSyncOwnership({ pool: db.pool });
  await own(libraryId, async () => {
    expect((await read()).reason).toBe('active_owner');
    await expect(confirm(preview)).rejects.toMatchObject({ status: 409, code: 'ingestion_owned' });
  });
  expect(await statuses()).toEqual([{ id: syncId, status: 'running' }]);
});

test.each(['progress', 'new_marker', 'capture', 'source', 'enabled'])('changed %s invalidates confirmation without writes', async change => {
  const preview = await read();
  if (change === 'progress') await db.query('UPDATE media_server_sync_status SET items_processed=8 WHERE id=$1', [syncId]);
  if (change === 'new_marker') await db.query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','pending')", [libraryId]);
  if (change === 'capture') await createMediaSyncOwnership(db)(libraryId,
    () => new MediaSourceObservationStore().start(serverId, libraryId, { source: 'local_capture' }));
  if (change === 'source') await db.query("UPDATE media_server SET api_key='changed synthetic' WHERE id=$1", [serverId]);
  if (change === 'enabled') await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  await expect(confirm(preview)).rejects.toMatchObject({ status: 412 });
  expect((await statuses()).every(row => ['pending', 'running'].includes(row.status))).toBe(true);
});

test('disabled admin and enabled library fail closed; missing receipts do not prove failure', async () => {
  const preview = await read();
  await db.query('UPDATE users SET is_active=false WHERE id=$1', [actorId]);
  await expect(confirm(preview)).rejects.toMatchObject({ status: 403 });
  await expect(read()).rejects.toMatchObject({ status: 403 });
  await db.query('UPDATE users SET is_active=true WHERE id=$1', [actorId]);
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  const enabled = await read();
  expect(enabled.reason).toBe('disable_library');
  await expect(confirm(enabled)).rejects.toMatchObject({ status: 409, code: 'disable_library' });
  expect(await service.receipt(actorId, libraryId, randomUUID())).toEqual({ status: 'not_observed', receipt: null });
});

test('audit failure rolls back marker updates and checkpoint creation', async () => {
  // A synthetic, suite-local trigger simulates a full/unavailable audit destination.
  await db.query(`CREATE FUNCTION reject_synthetic_ingestion_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='library_ingestion_reconciled' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
  await db.query('CREATE TRIGGER reject_synthetic_ingestion_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_synthetic_ingestion_audit()');
  try {
    await expect(confirm(await read())).rejects.toThrow('synthetic audit failure');
    expect(await statuses()).toEqual([{ id: syncId, status: 'running' }]);
    expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows[0].phase).toBe('collecting');
    expect((await db.query('SELECT count(*)::int AS n FROM library_ingestion_state WHERE library_id=$1', [libraryId])).rows[0].n).toBe(0);
  } finally {
    await db.query('DROP TRIGGER reject_synthetic_ingestion_audit ON audit_log');
    await db.query('DROP FUNCTION reject_synthetic_ingestion_audit()');
  }
});

test('foreign records stay discoverable while the library is disabled', async () => {
  expect((await db.query(`SELECT ${LIBRARY_INGESTION_STATUS_SQL} AS status FROM libraries l WHERE l.id=$1`, [libraryId])).rows[0].status)
    .toMatchObject({ needsReconciliation: true });
});

test('concurrent confirmations commit at most one reconciliation', async () => {
  const preview = await read();
  const attempts = await Promise.allSettled([confirm(preview), confirm(preview)]);
  expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1);
  const rejected = attempts.find(attempt => attempt.status === 'rejected');
  expect([409, 412]).toContain(rejected.reason.status);
  expect((await db.query('SELECT count(*)::int AS n FROM audit_log WHERE user_id=$1', [actorId])).rows[0].n).toBe(1);
  expect(await statuses()).toEqual([{ id: syncId, status: 'failed' }]);
});

test('receipts cannot be reused with another actor, library or revision, or after access revocation', async () => {
  const requestId = randomUUID(), preview = await read();
  await confirm(preview, requestId);
  const otherActor = (await db.query("INSERT INTO users(username,password_hash,role,is_active) VALUES ($1,'synthetic','admin',true) RETURNING id", [randomUUID()])).rows[0].id;
  try {
    await expect(service.receipt(otherActor, libraryId, requestId)).rejects.toMatchObject({ status: 409 });
    await expect(service.receipt(actorId, libraryId + 1, requestId)).rejects.toMatchObject({ status: 409 });
    await expect(confirm(await read(), requestId)).rejects.toMatchObject({ status: 409 });
    await db.query("UPDATE users SET role='user' WHERE id=$1", [actorId]);
    await expect(service.receipt(actorId, libraryId, requestId)).rejects.toMatchObject({ status: 403 });
  } finally {
    await db.query('DELETE FROM users WHERE id=$1', [otherActor]);
  }
});

test('unverifiable audit receipts fail closed instead of claiming reconciliation succeeded', async () => {
  const requestId = randomUUID();
  await confirm(await read(), requestId);
  await db.query("UPDATE audit_log SET metadata=metadata-'verification' WHERE user_id=$1", [actorId]);
  await expect(service.receipt(actorId, libraryId, requestId)).rejects.toMatchObject({ status: 503 });
});

test('more than the bounded marker count cannot authorize a partial reconciliation', async () => {
  await db.query("INSERT INTO media_server_sync_status(library_id,sync_type,status) SELECT $1,'full','pending' FROM generate_series(1,100)", [libraryId]);
  const preview = await read();
  expect(preview).toMatchObject({ reason: 'too_many_markers', canReconcile: false, truncated: true });
  expect(preview.syncs).toHaveLength(100);
  await expect(confirm(preview)).rejects.toMatchObject({ status: 409, code: 'too_many_markers' });
  expect((await statuses()).every(row => ['running', 'pending'].includes(row.status))).toBe(true);
  expect((await db.query('SELECT count(*)::int AS n FROM audit_log WHERE user_id=$1', [actorId])).rows[0].n).toBe(0);
});

test('a fresh library without legacy records requires no reconciliation or checkpoint', async () => {
  await db.query('DELETE FROM media_server_sync_status WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM media_source_capture_state WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  const preview = await read();
  expect(preview).toMatchObject({ reason: 'not_needed', canReconcile: false, syncs: [], capture: null });
  await expect(confirm(preview)).rejects.toMatchObject({ status: 409, code: 'not_needed' });
  expect((await db.query('SELECT count(*)::int AS n FROM library_ingestion_state WHERE library_id=$1', [libraryId])).rows[0].n).toBe(0);
  expect((await db.query('SELECT count(*)::int AS n FROM audit_log WHERE user_id=$1', [actorId])).rows[0].n).toBe(0);
});
