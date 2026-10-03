/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { withSourcePageFixtures } from '../helpers/sourcePageFixture.mjs';
import { resourceAdmissionFixture } from '../helpers/resourceAdmissionFixture.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../services/contentTypeAnalyzer.mjs', () => ({ contentTypeAnalyzer: { analyze: async () => ({ analyzed: false }) } }));
const { createLegacyIngestionService } = await import('../../services/legacyIngestionService.mjs');
const { createMediaSyncOwnership } = await import('../../services/mediaSyncOwnership.mjs');
const { MediaSyncService } = await import('../../services/mediaSync.mjs');
const { QueueRefillService } = await import('../../services/queueRefillService.mjs');
const { materializeInventoryBackfillPage, drainInventoryBackfillHandoffs } = await import('../../services/inventoryBackfillHandoff.mjs');
const { verifyNextIngestionRecovery } = await import('../../services/ingestionRecoveryVerification.mjs');
const db = createIntegrationDatabaseModuleMock(), service = createLegacyIngestionService(db);
const logger = { warn: jest.fn(), error() {}, info() {}, debug() {} };
const refill = new QueueRefillService({ db, logger });
let libraryId, serverId, actorId;
const history = async () => (await service.history(actorId, libraryId)).receipts;
const progress = async () => (await history())[0].progress;
const operation = async () => (await db.query('SELECT * FROM ingestion_recovery_progress WHERE library_id=$1 ORDER BY audit_id DESC', [libraryId])).rows[0];
const due = () => db.query("UPDATE ingestion_recovery_progress SET next_check_at=clock_timestamp()-interval '1 second' WHERE library_id=$1", [libraryId]);
const verify = () => verifyNextIngestionRecovery({ db, logger });
const handoff = () => materializeInventoryBackfillPage({ db, logger, buildPayload: row => refill.buildMetadataEnrichmentPayload(row) });
const recover = async () => {
  const preview = await service.preview(actorId, libraryId);
  return service.confirm(actorId, libraryId, { requestId: randomUUID(), workersStopped: true, resume: true }, preview.revision);
};
const importer = (items = [{ external_id: 'new', tmdb_id: 88, media_type: 'movie', title: 'Synthetic' }]) => new MediaSyncService({
  resourceAdmission: resourceAdmissionFixture(),
  mediaServerServices: { getMediaServerService: async () => withSourcePageFixtures({
    getLibraryItems: async () => { if (items instanceof Error) throw items; return items; }, getCollections: async () => [],
  }) }, skipReporter: { report: async () => {} },
});
const ready = async () => {
  await db.query(`UPDATE media_server_items SET metadata='{"content_analysis":{"source":"metadata_enrichment"}}'::jsonb WHERE library_id=$1`, [libraryId]);
  await db.query("UPDATE task_queue SET status='completed' WHERE payload->>'source_library_id'=$1::text", [libraryId]);
};
beforeEach(async () => {
  await db.query('UPDATE libraries SET is_active=false');
  await db.query('UPDATE omdb_config SET is_active=false');
  await db.query('UPDATE tmdb_config SET is_active=false');
  actorId = (await db.query("INSERT INTO users(username,password_hash,role,is_active) VALUES ($1,'synthetic','admin',true) RETURNING id", [randomUUID()])).rows[0].id;
  serverId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://synthetic.invalid','synthetic') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,$1,'movie',$2,true) RETURNING id", [randomUUID(), serverId])).rows[0].id;
  await db.query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','running')", [libraryId]);
  await db.query("INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,tmdb_id) VALUES ($1,$2,'old','Synthetic','movie',77)", [serverId, libraryId]);
  logger.warn.mockClear();
});
afterEach(async () => {
  await db.query("DELETE FROM task_queue WHERE payload->>'source_library_id'=$1::text", [libraryId]);
  await db.query('DELETE FROM audit_log WHERE user_id=$1', [actorId]);
  await db.query('DELETE FROM media_server_sync_status WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
  await db.query('DELETE FROM users WHERE id=$1', [actorId]);
});

test.each(['plex', 'jellyfin', 'emby'])('%s recovery survives retry/restart and completes only with committed metadata evidence', async provider => {
  await db.query('UPDATE media_server SET type=$2 WHERE id=$1', [serverId, provider]);
  const { receipt } = await recover(), initial = await operation();
  expect(await progress()).toMatchObject({ stage: 'requested', metadata: null });
  await importer(new Error('synthetic offline')).syncLibrary(libraryId);
  const interrupted = await operation();
  expect(interrupted.run_id).not.toBe(initial.run_id);
  expect(interrupted.request_id).toBe(receipt.requestId);
  expect(await progress()).toMatchObject({ stage: 'waiting', reason: 'import_retry' });
  expect((await db.query('SELECT external_id FROM media_server_items WHERE library_id=$1', [libraryId])).rows).toEqual([{ external_id: 'old' }]);
  await db.query("UPDATE library_ingestion_state SET retry_after=clock_timestamp()-interval '1 second' WHERE library_id=$1", [libraryId]);
  expect(await importer().syncLibrary(libraryId, { incremental: true })).toMatchObject({ success: true });
  expect((await operation()).run_id).not.toBe(interrupted.run_id);
  expect(await progress()).toMatchObject({ stage: 'backfilling', reason: 'enqueue_pending' });
  expect(await verify()).toEqual({ status: 'idle' });
  expect(await handoff()).toEqual({ queued: 1 });
  await db.query("UPDATE task_queue SET status='completed' WHERE payload->>'source_library_id'=$1::text", [libraryId]);
  expect(await verify()).toEqual({ status: 'backfilling' }); // Queue completion alone is insufficient.
  expect(await progress()).toMatchObject({ metadata: { total: 1, ready: 0, pending: 1, blocked: 0 } });
  await ready(); await due();
  await db.query("INSERT INTO task_queue(task_type,status,payload) VALUES ('embedding','pending',$1::jsonb)", [JSON.stringify({ source_library_id: libraryId })]);
  expect(await verify()).toEqual({ status: 'completed' });
  const restarted = createLegacyIngestionService(db);
  expect((await restarted.history(actorId, libraryId)).receipts[0]).toMatchObject({ requestId: receipt.requestId,
    progress: { stage: 'completed', metadata: { total: 1, ready: 1, pending: 0, blocked: 0 } } });
  expect((await operation()).verified_at).not.toBeNull();
  expect(await verify()).toEqual({ status: 'idle' });
});

test('two reviewed recoveries do not share progress, and audit retention removes only tracking', async () => {
  const first = (await recover()).receipt;
  await db.query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','pending')", [libraryId]);
  const second = (await recover()).receipt;
  expect(await history()).toMatchObject([{ requestId: second.requestId, progress: { stage: 'requested' } },
    { requestId: first.requestId, progress: { stage: 'superseded', reason: 'new_recovery' } }]);
  await db.query('DELETE FROM audit_log WHERE id=$1', [first.auditId]);
  expect((await db.query('SELECT audit_id FROM ingestion_recovery_progress WHERE library_id=$1', [libraryId])).rows).toEqual([{ audit_id: second.auditId }]);
  expect((await db.query('SELECT count(*)::int AS n FROM media_server_items WHERE library_id=$1', [libraryId])).rows[0].n).toBe(1);
});

test('later ordinary scans supersede unverified history', async () => {
  await recover(); await importer().syncLibrary(libraryId); await handoff();
  await importer().syncLibrary(libraryId);
  expect(await progress()).toMatchObject({ stage: 'superseded', reason: 'new_scan' });
  await ready(); await due();
  expect(await verify()).toEqual({ status: 'idle' });
  expect((await operation()).verified_at).toBeNull();
});

test.each(['library', 'server', 'archive'])('disabled %s waits and resumes with the same source identity', async target => {
  await recover(); await importer().syncLibrary(libraryId); await handoff(); await ready();
  if (target === 'server') await db.query('UPDATE media_server SET is_active=false WHERE id=$1', [serverId]);
  else await db.query(`UPDATE libraries SET is_active=false,archived_at=CASE WHEN $2 THEN clock_timestamp() ELSE NULL END WHERE id=$1`, [libraryId, target === 'archive']);
  expect(await verify()).toEqual({ status: 'idle' });
  expect(await progress()).toMatchObject({ stage: 'blocked', reason: 'disabled' });
  await db.query('UPDATE libraries SET is_active=true,archived_at=NULL WHERE id=$1', [libraryId]);
  await db.query('UPDATE media_server SET is_active=true WHERE id=$1', [serverId]);
  expect(await verify()).toEqual({ status: 'completed' });
});

test('a changed endpoint never verifies the previous source; an active import is not interrupted', async () => {
  await recover(); await importer().syncLibrary(libraryId); await handoff(); await ready();
  await createMediaSyncOwnership({ pool: db.pool })(libraryId, async () => {
    expect(await verify()).toEqual({ status: 'deferred' });
  });
  await due();
  await db.query("UPDATE media_server SET url='http://different.synthetic.invalid' WHERE id=$1", [serverId]);
  expect(await verify()).toEqual({ status: 'idle' });
  expect(await progress()).toMatchObject({ stage: 'superseded', reason: 'source_changed' });
});

test('verification timeouts keep durable cooldown and do not stop normal refill', async () => {
  await recover(); await importer().syncLibrary(libraryId); await handoff(); await ready();
  const failing = { withTransaction: fn => db.withTransaction(client => fn({ query: (sql, values) => {
    if (sql.startsWith('WITH evidence')) throw new Error('synthetic timeout');
    return client.query(sql, values);
  } })) };
  expect(await verifyNextIngestionRecovery({ db: failing, logger })).toEqual({ status: 'unavailable' });
  expect((await operation()).verified_at).toBeNull();
  expect((await db.query('SELECT next_check_at>clock_timestamp() AS cooling FROM ingestion_recovery_progress WHERE library_id=$1', [libraryId])).rows[0].cooling).toBe(true);
  expect(await verify()).toEqual({ status: 'idle' });
  await due();
  expect(await drainInventoryBackfillHandoffs({ db, logger, buildPayload: row => refill.buildMetadataEnrichmentPayload(row) })).toBeNull();
  expect(await progress()).toMatchObject({ stage: 'completed' });
});

test('failed and deferred metadata remain visible instead of being counted as completed', async () => {
  await recover(); await importer().syncLibrary(libraryId); await handoff();
  await db.query("UPDATE task_queue SET status='failed' WHERE payload->>'source_library_id'=$1::text", [libraryId]);
  expect(await verify()).toEqual({ status: 'backfilling' });
  expect(await progress()).toMatchObject({ stage: 'blocked', reason: 'metadata_failures', metadata: { blocked: 1 } });
  await ready(); await due();
  await db.query("INSERT INTO enrichment_retry_queue(media_item_id,reason,next_attempt_at) SELECT id,'tavily_monthly_quota_deferred',clock_timestamp()+interval '1 day' FROM media_server_items WHERE library_id=$1", [libraryId]);
  expect(await verify()).toEqual({ status: 'backfilling' });
  expect(await progress()).toMatchObject({ metadata: { ready: 0, pending: 1 } });
  await db.query("UPDATE enrichment_retry_queue SET status='completed' WHERE media_item_id IN (SELECT id FROM media_server_items WHERE library_id=$1)", [libraryId]);
  await due(); expect(await verify()).toEqual({ status: 'completed' });
});

test('empty full capture can complete, but missing or rejected capture evidence cannot', async () => {
  await recover(); await importer([]).syncLibrary(libraryId); await handoff();
  await db.query("UPDATE media_source_capture_state SET phase='failed' WHERE library_id=$1", [libraryId]);
  expect(await verify()).toEqual({ status: 'deferred' });
  await db.query("UPDATE media_source_capture_state SET phase='complete' WHERE library_id=$1", [libraryId]);
  await due();
  await db.query('UPDATE media_source_capture_state SET rejected_count=1 WHERE library_id=$1', [libraryId]);
  expect(await verify()).toEqual({ status: 'deferred' });
  expect(await progress()).toMatchObject({ stage: 'blocked', reason: 'source_ids' });
  await db.query('UPDATE media_source_capture_state SET rejected_count=0 WHERE library_id=$1', [libraryId]);
  await due(); expect(await verify()).toEqual({ status: 'completed' });
  expect(await progress()).toMatchObject({ metadata: { total: 0, ready: 0 } });
});

test('concurrent verification admits once, and later scans cannot rewrite historical completion', async () => {
  await recover(); await importer().syncLibrary(libraryId); await handoff(); await ready();
  const results = await Promise.all([verify(), verify()]);
  expect(results.map(result => result.status).sort()).toEqual(['completed', 'idle']);
  const completed = await progress();
  await importer([]).syncLibrary(libraryId);
  expect(await progress()).toEqual(completed);
});

test('database constraints reject partial counts and unverified completion', async () => {
  await recover();
  await expect(db.query("UPDATE ingestion_recovery_progress SET stage='completed' WHERE library_id=$1", [libraryId])).rejects.toMatchObject({ code: '23514' });
  await expect(db.query('UPDATE ingestion_recovery_progress SET metadata_total=1 WHERE library_id=$1', [libraryId])).rejects.toMatchObject({ code: '23514' });
});

test('failed import progress persistence rolls back pruning and canonical finalization together', async () => {
  await recover();
  await db.query(`CREATE FUNCTION reject_import_progress() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.stage='backfilling' THEN RAISE EXCEPTION 'synthetic completion failure'; END IF; RETURN NEW; END $$`);
  await db.query('CREATE TRIGGER reject_import_progress BEFORE UPDATE ON ingestion_recovery_progress FOR EACH ROW EXECUTE FUNCTION reject_import_progress()');
  try {
    await expect(importer().syncLibrary(libraryId)).rejects.toThrow('synthetic completion failure');
    expect((await db.query("SELECT id FROM media_server_items WHERE library_id=$1 AND external_id='old'", [libraryId])).rowCount).toBe(1);
    expect((await operation()).imported_at).toBeNull();
    expect((await db.query('SELECT phase FROM library_ingestion_state WHERE library_id=$1', [libraryId])).rows[0].phase).toBe('retry_wait');
  } finally {
    await db.query('DROP TRIGGER reject_import_progress ON ingestion_recovery_progress');
    await db.query('DROP FUNCTION reject_import_progress()');
  }
});

test('tracking failure rolls back the reviewed recovery, including its audit receipt', async () => {
  await db.query(`CREATE FUNCTION reject_recovery_tracking() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic tracking failure'; END $$`);
  await db.query('CREATE TRIGGER reject_recovery_tracking BEFORE INSERT ON ingestion_recovery_progress FOR EACH ROW EXECUTE FUNCTION reject_recovery_tracking()');
  try {
    await expect(recover()).rejects.toThrow('synthetic tracking failure');
    expect((await db.query('SELECT status FROM media_server_sync_status WHERE library_id=$1', [libraryId])).rows).toEqual([{ status: 'running' }]);
    expect(await history()).toEqual([]);
    expect((await db.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [libraryId])).rows).toEqual([]);
  } finally {
    await db.query('DROP TRIGGER reject_recovery_tracking ON ingestion_recovery_progress');
    await db.query('DROP FUNCTION reject_recovery_tracking()');
  }
});
