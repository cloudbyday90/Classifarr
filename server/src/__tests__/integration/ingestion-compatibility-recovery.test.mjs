/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { readRuntime } from './runtime.mjs';
import { resourceAdmissionFixture } from '../helpers/resourceAdmissionFixture.mjs';
import { withSourcePageFixtures } from '../helpers/sourcePageFixture.mjs';
import { readIngestionRecoveryHistory } from '../../services/legacyIngestionHistory.mjs';
jest.unstable_mockModule('../../services/contentTypeAnalyzer.mjs', () => ({ contentTypeAnalyzer: { analyze: async () => ({ analyzed: false }) } }));
const { createMediaSyncOwnership } = await import('../../services/mediaSyncOwnership.mjs');
const { MediaSyncService } = await import('../../services/mediaSync.mjs');
const { LIBRARY_INGESTION_WATCHDOG_SQL, LIBRARY_INGESTION_STATUS_SQL } = await import('../../services/libraryIngestionStatus.mjs');
const db = createIntegrationDatabaseModuleMock();
const tables = ['media_server_items', 'media_server_sync_status', 'media_source_capture_state',
  'library_ingestion_state', 'media_source_observations', 'media_server_collections'];
let serverId, libraryId;
beforeEach(async () => {
  serverId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,$2,'synthetic') RETURNING id", [randomUUID(), `http://${randomUUID()}.invalid`])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,'test','movie',$2,true) RETURNING id", [randomUUID(), serverId])).rows[0].id;
  await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type)
    VALUES ($1,$2,'retained','Existing inventory','movie')`, [serverId, libraryId]);
});
afterEach(async () => {
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM media_server_sync_status WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
});
const claim = () => createMediaSyncOwnership({ pool: getPool() })(libraryId, owner => owner.claim());
const pending = async () => Number((await db.query("SELECT count(*) FROM media_server_sync_status WHERE library_id=$1 AND status='running'", [libraryId])).rows[0].count);
const inventory = async () => (await db.query('SELECT external_id FROM media_server_items WHERE library_id=$1 ORDER BY external_id', [libraryId])).rows.map(r => r.external_id);
const status = async () => (await db.query(`SELECT ${LIBRARY_INGESTION_STATUS_SQL} AS status FROM libraries l WHERE l.id=$1`, [libraryId])).rows[0].status;
async function seedLegacy(count = 6) {
  // Only this disposable suite database: emulate rows that existed before DDL cutover.
  await db.withTransaction(async client => {
    await client.query('ALTER TABLE media_server_sync_status DISABLE TRIGGER ingestion_compatibility_rows');
    await client.query(`INSERT INTO media_server_sync_status(media_server_id,library_id,sync_type,status)
      SELECT $1,$2,'full','running' FROM generate_series(1,$3)`, [serverId, libraryId, count]);
    await client.query('ALTER TABLE media_server_sync_status ENABLE ALWAYS TRIGGER ingestion_compatibility_rows');
  });
}
async function oldClient() {
  const runtime = readRuntime();
  const database = (await db.query('SELECT current_database() AS name')).rows[0].name;
  const client = new pg.Client({ host: runtime.host, port: runtime.port, user: runtime.user,
    password: runtime.password, database, options: '-c statement_timeout=8000', connectionTimeoutMillis: 3000 });
  await client.connect();
  return client;
}

test('old clients cannot mutate inventory, including cascades and truncate; current clients stamp markers', async () => {
  const old = await oldClient();
  try {
    for (const sql of [
      `UPDATE media_server_items SET title='late old page' WHERE library_id=${libraryId}`,
      `DELETE FROM media_server_items WHERE library_id=${libraryId}`,
      `DELETE FROM libraries WHERE id=${libraryId}`,
      `INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES (${libraryId},'full','running')`,
      'TRUNCATE media_server_items CASCADE',
    ]) await expect(old.query(sql)).rejects.toMatchObject({ code: '55000', message: 'ingestion_writer_upgrade_required' });
    await old.query("SET session_replication_role='replica'");
    await expect(old.query(`DELETE FROM media_server_items WHERE library_id=${libraryId}`)).rejects.toMatchObject({ code: '55000' });
    expect(await inventory()).toEqual(['retained']);
    const result = await db.query("INSERT INTO media_server_sync_status(library_id,sync_type,status,ingestion_protocol) VALUES ($1,'full','running',0) RETURNING ingestion_protocol", [libraryId]);
    expect(result.rows[0].ingestion_protocol).toBe(1);
  } finally { await old.end(); }
});

test('transactional migration drains in-flight writes and blocks late writes from a pre-cutover snapshot', async () => {
  // Undo only the new migration in this owned test DB, then execute its actual SQL.
  await db.withTransaction(async client => {
    for (const table of tables) {
      await client.query(`DROP TRIGGER ingestion_compatibility_rows ON ${table}`);
      await client.query(`DROP TRIGGER ingestion_compatibility_truncate ON ${table}`);
    }
    await client.query('DROP FUNCTION enforce_ingestion_compatibility()');
    await client.query('DROP INDEX idx_ingestion_compatibility_history');
    await client.query('ALTER TABLE media_server_sync_status DROP COLUMN ingestion_protocol');
    await client.query('ALTER TABLE media_source_capture_state DROP COLUMN ingestion_protocol');
  });
  const old = await oldClient(), snapshot = await oldClient();
  const migration = await readFile(new URL('../../../../database/migrations/20261005_180000_ingestion_compatibility_fence.sql', import.meta.url), 'utf8');
  try {
    await old.query('BEGIN');
    await old.query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','running')", [libraryId]);
    await snapshot.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await snapshot.query('SELECT 1');
    // A bounded lock failure must leave the cutover unapplied, never partially fenced.
    await expect(db.withTransaction(client => client.query(migration.replace("lock_timeout = '5s'", "lock_timeout = '100ms'"))))
      .rejects.toMatchObject({ code: '55P03' });
    await old.query('COMMIT');
    await db.withTransaction(client => client.query(migration));
    await expect(snapshot.query(`UPDATE media_server_items SET title='late snapshot' WHERE library_id=${libraryId}`))
      .rejects.toMatchObject({ code: '55000' });
    await snapshot.query('ROLLBACK');
    await expect(old.query(`UPDATE media_server_sync_status SET status='completed' WHERE library_id=${libraryId}`))
      .rejects.toMatchObject({ code: '55000' });
    expect(await claim()).toMatchObject({ replay: true, recovered: 1 });
    expect(await inventory()).toEqual(['retained']);
  } finally { await old.end(); await snapshot.end(); }
});

test.each(['plex', 'jellyfin', 'emby'].flatMap(provider => ['movie', 'tv'].map(mediaType => [provider, mediaType])))
  ('%s %s automatically replays legacy work, retains inventory during outage, and tracks metadata separately', async (provider, mediaType) => {
  await db.query('UPDATE media_server SET type=$2 WHERE id=$1', [serverId, provider]);
  await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [libraryId, mediaType]);
  await seedLegacy();
  expect(await status()).toMatchObject({ state: 'legacy_owner_unknown', recoveryMode: 'automatic' });
  expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(r => r.id)).toContain(libraryId);
  const makeSync = getLibraryItems => new MediaSyncService({ resourceAdmission: resourceAdmissionFixture(),
    mediaServerServices: { getMediaServerService: async () => withSourcePageFixtures({ getLibraryItems, getCollections: async () => [] }) },
    skipReporter: { report: async () => {} } });
  expect(await makeSync(async () => { throw new Error('synthetic outage'); }).syncLibrary(libraryId, { incremental: true }))
    .toMatchObject({ deferred: true });
  expect(await pending()).toBe(0);
  expect(await inventory()).toEqual(['retained']);
  const before = (await db.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [libraryId])).rows[0];
  expect(await claim()).toEqual({ reason: 'retry_wait' });
  // Fixture deadline advance: proves durable continuation, not elapsed cooldown.
  await db.query("UPDATE library_ingestion_state SET retry_after=clock_timestamp()-interval '1 second' WHERE library_id=$1", [libraryId]);
  expect(await makeSync(async () => [{ external_id: 'new', tmdb_id: 22, title: 'Synthetic', media_type: mediaType }])
    .syncLibrary(libraryId, { incremental: true })).toMatchObject({ success: true });
  expect(await inventory()).toEqual(['new']);
  const progress = (await db.query('SELECT * FROM ingestion_recovery_progress WHERE library_id=$1', [libraryId])).rows;
  expect(progress).toHaveLength(1);
  expect(progress[0]).toMatchObject({ stage: 'backfilling', verified_at: null });
  expect(progress[0].run_id).not.toBe(before.run_id);
  const history = await readIngestionRecoveryHistory(db, { libraryId, actorId: 987 });
  expect(history.receipts).toHaveLength(1);
  expect(history.receipts[0]).toMatchObject({ automatic: true, replay: 'scheduled' });
});

test('large marker histories recover in bounded audited batches without deleting inventory', async () => {
  await seedLegacy(205);
  expect(await claim()).toEqual({ reason: 'legacy_recovery_pending' });
  expect(await pending()).toBe(105);
  expect(await claim()).toEqual({ reason: 'legacy_recovery_pending' });
  expect(await pending()).toBe(5);
  expect(await claim()).toMatchObject({ recovered: 5, replay: true });
  expect(await inventory()).toEqual(['retained']);
  const audits = (await db.query("SELECT user_id,metadata FROM audit_log WHERE action='library_ingestion_compatibility_recovered' AND metadata->>'libraryId'=$1 ORDER BY id", [String(libraryId)])).rows;
  expect(audits.map(r => r.metadata.syncIds.length)).toEqual([100, 100, 5]);
  expect(audits.every(r => r.user_id === null && r.metadata.workersStopped === undefined)).toBe(true);
});

test.each(['disabled', 'archived', 'unconfigured', 'current_writer', 'missing_fence'])('%s remains untouched', async mode => {
  await seedLegacy();
  if (mode === 'disabled') await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  if (mode === 'archived') await db.query('UPDATE libraries SET is_active=false,archived_at=clock_timestamp() WHERE id=$1', [libraryId]);
  if (mode === 'unconfigured') await db.query("UPDATE media_server SET api_key='' WHERE id=$1", [serverId]);
  if (mode === 'current_writer') await db.query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','running')", [libraryId]);
  if (mode === 'missing_fence') await db.query('ALTER TABLE media_server_items DISABLE TRIGGER ingestion_compatibility_rows');
  try {
    const modes = { disabled: 'disabled', archived: 'disabled', unconfigured: 'unconfigured', current_writer: 'review', missing_fence: 'deployment_required' };
    expect(await status()).toMatchObject({ recoveryMode: modes[mode] });
    if (mode === 'missing_fence') expect((await status()).recoveryDiagnostic).toMatchObject({
      protocolReady: true, migrationRecorded: true, checks: [{ table: 'media_server_items', trigger: 'ingestion_compatibility_rows', status: 'not_always_enabled' }],
    });
    expect(await claim()).toEqual({ reason: 'legacy_owner_unknown' });
    expect(await pending()).toBe(mode === 'current_writer' ? 7 : 6);
    expect(await inventory()).toEqual(['retained']);
  } finally {
    if (mode === 'missing_fence') await db.query('ALTER TABLE media_server_items ENABLE ALWAYS TRIGGER ingestion_compatibility_rows');
  }
});

test('diagnostics distinguish missing history, missing triggers and an incompatible connection without writing', async () => {
  await seedLegacy();
  const old = await oldClient();
  try {
    const result = await old.query(`SELECT ${LIBRARY_INGESTION_STATUS_SQL} AS status FROM libraries l WHERE l.id=$1`, [libraryId]);
    expect(result.rows[0].status.recoveryDiagnostic).toMatchObject({ protocolReady: false, migrationRecorded: true, checks: [] });
    const rollback = new Error('rollback synthetic diagnostic fixture');
    await expect(db.withTransaction(async client => {
      await client.query('DROP TRIGGER ingestion_compatibility_truncate ON media_server_items');
      await client.query("DELETE FROM schema_migrations WHERE filename='20261005_180000_ingestion_compatibility_fence.sql'");
      const read = await client.query(`SELECT ${LIBRARY_INGESTION_STATUS_SQL} AS status FROM libraries l WHERE l.id=$1`, [libraryId]);
      expect(read.rows[0].status.recoveryDiagnostic).toEqual({
        migration: '20261005_180000_ingestion_compatibility_fence.sql', migrationRecorded: false, protocolReady: true,
        checks: [{ table: 'media_server_items', trigger: 'ingestion_compatibility_truncate', status: 'missing' }],
      });
      // Roll back synthetic catalog/history changes together, even when assertions fail.
      throw rollback;
    })).rejects.toBe(rollback);
    await expect(db.withTransaction(async client => {
      await client.query('DROP TRIGGER ingestion_compatibility_rows ON media_server_items');
      await client.query(`CREATE TRIGGER ingestion_compatibility_rows BEFORE UPDATE ON media_server_items
        FOR EACH ROW EXECUTE FUNCTION enforce_ingestion_compatibility()`);
      await client.query('ALTER TABLE media_server_items DISABLE TRIGGER ingestion_compatibility_rows');
      const read = await client.query(`SELECT ${LIBRARY_INGESTION_STATUS_SQL} AS status FROM libraries l WHERE l.id=$1`, [libraryId]);
      expect(read.rows[0].status.recoveryDiagnostic.checks).toEqual([
        { table: 'media_server_items', trigger: 'ingestion_compatibility_rows', status: 'definition_mismatch' },
      ]);
      throw rollback;
    })).rejects.toBe(rollback);
    expect(await pending()).toBe(6);
    expect(await inventory()).toEqual(['retained']);
  } finally { await old.end(); }
});

test('audit failure rolls back retired markers and no fresh install recovery is fabricated', async () => {
  expect(await status()).toMatchObject({ state: 'awaiting_import', recoveryMode: null, recoveryDiagnostic: null });
  expect(await claim()).toEqual({ replay: true });
  expect(Number((await db.query('SELECT count(*) FROM ingestion_recovery_progress WHERE library_id=$1', [libraryId])).rows[0].count)).toBe(0);
  await seedLegacy();
  await db.query(`CREATE FUNCTION fail_compatibility_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='library_ingestion_compatibility_recovered' THEN RAISE EXCEPTION 'synthetic_audit_failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_compatibility_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_compatibility_audit()`);
  try {
    await expect(claim()).rejects.toThrow('synthetic_audit_failure');
    expect(await pending()).toBe(6);
    expect(await inventory()).toEqual(['retained']);
  } finally { await db.query('DROP TRIGGER fail_compatibility_audit ON audit_log; DROP FUNCTION fail_compatibility_audit()'); }
});

test('legacy capture alone recovers, but a competing current owner is never displaced', async () => {
  await db.withTransaction(async client => {
    await client.query('ALTER TABLE media_source_capture_state DISABLE TRIGGER ingestion_compatibility_rows');
    await client.query(`INSERT INTO media_source_capture_state(library_id,media_server_id,generation,mode,phase,source)
      VALUES ($1,$2,1,'full','collecting','local_capture')`, [libraryId, serverId]);
    await client.query('ALTER TABLE media_source_capture_state ENABLE ALWAYS TRIGGER ingestion_compatibility_rows');
  });
  const own = createMediaSyncOwnership({ pool: getPool() });
  await own(libraryId, async () => {
    expect(await status()).toMatchObject({ recoveryMode: 'active' });
    expect(await claim()).toMatchObject({ deferred: true, reason: 'ingestion_owned' });
    expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows[0].phase).toBe('collecting');
  });
  expect(await claim()).toMatchObject({ replay: true, recovered: 0 });
  expect((await db.query('SELECT phase,ingestion_protocol FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows[0])
    .toMatchObject({ phase: 'failed', ingestion_protocol: 1 });
});
