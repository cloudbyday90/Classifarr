/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { createLibraryDiscoveryStatusRepository } from '../../services/libraryDiscoveryStatusRepository.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { createLibraryArchiveService } = await import('../../services/libraryArchiveService.mjs');
const { reconcileMediaServerLibraries, syncMediaServerLibraries } = await import('../../services/mediaServerLibrarySync.mjs');
const { createMediaSyncOwnership } = await import('../../services/mediaSyncOwnership.mjs');
const db = createIntegrationDatabaseModuleMock();
const provider = { getLibraryCatalog: jest.fn() }, resolveService = () => provider;
const service = createLibraryArchiveService(db, resolveService);
let actorId, sourceId, libraryId, externalId;
const read = () => service.preview(actorId, libraryId);
const confirm = (preview, requestId = randomUUID()) => service.confirm(actorId, libraryId,
  { requestId, operation: preview.operation, workersStopped: true }, preview.revision);
const reconcile = () => reconcileMediaServerLibraries({ db, getMediaServerServiceByType: resolveService });
const library = async () => (await db.query('SELECT * FROM libraries WHERE id=$1', [libraryId])).rows[0];
beforeEach(async () => {
  await db.query('UPDATE media_server SET is_active=false');
  actorId = (await db.query("INSERT INTO users(username,password_hash,role,is_active) VALUES ($1,'synthetic','admin',true) RETURNING id", [randomUUID()])).rows[0].id;
  sourceId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://synthetic.invalid','synthetic') RETURNING id", [randomUUID()])).rows[0].id;
  externalId = randomUUID();
  libraryId = (await db.query("INSERT INTO libraries(media_server_id,external_id,name,media_type,is_active) VALUES ($1,$2,'Synthetic','movie',false) RETURNING id", [sourceId, externalId])).rows[0].id;
  await db.query("INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,tmdb_id) VALUES ($1,$2,'old','Synthetic','movie',77)", [sourceId, libraryId]);
  provider.getLibraryCatalog.mockReset().mockResolvedValue([]);
});
afterEach(async () => {
  await db.query('DELETE FROM audit_log WHERE user_id=$1', [actorId]);
  await db.query('DELETE FROM media_server_sync_status WHERE media_server_id=$1', [sourceId]);
  await db.query('DELETE FROM libraries WHERE media_server_id=$1', [sourceId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [sourceId]);
  await db.query('DELETE FROM users WHERE id=$1', [actorId]);
});

test.each(['plex', 'emby', 'jellyfin'].flatMap(providerType => ['movie', 'tv'].map(type => [providerType, type])))
  ('%s %s discovery preserves data; archive/restore is audited and never enables', async (providerType, mediaType) => {
  await db.query('UPDATE media_server SET type=$2 WHERE id=$1', [sourceId, providerType]);
  await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [libraryId, mediaType]);
  expect(await reconcile()).toEqual({ libraries: [], preservedLibraries: [{ id: libraryId, name: 'Synthetic' }] });
  const preview = await read();
  expect(preview).toMatchObject({ operation: 'archive', canConfirm: true, itemCount: 1 });
  const requestId = randomUUID(), result = await confirm(preview, requestId);
  expect(await confirm(preview, requestId)).toEqual({ ...result, repeated: true });
  expect(await service.receipt(actorId, libraryId, requestId)).toEqual({ receipt: result.receipt });
  expect((await library()).archived_at).toBeTruthy();
  await expect(db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId])).rejects.toMatchObject({ code: '23514' });
  provider.getLibraryCatalog.mockResolvedValue([{ external_id: externalId, name: 'Remote renamed', media_type: mediaType }]);
  expect((await reconcile()).libraries).toEqual([]);
  expect((await library()).name).toBe('Synthetic');
  provider.getLibraryCatalog.mockRejectedValue(new Error('offline'));
  expect((await confirm(preview, requestId)).repeated).toBe(true);
  const restore = await read();
  expect(restore).toMatchObject({ operation: 'restore', canConfirm: true });
  await confirm(restore);
  expect(await library()).toMatchObject({ archived_at: null, is_active: false });
  expect((await db.query('SELECT external_id FROM media_server_items WHERE library_id=$1', [libraryId])).rows).toEqual([{ external_id: 'old' }]);
  expect((await db.query('SELECT count(*)::int AS n FROM audit_log WHERE user_id=$1', [actorId])).rows[0].n).toBe(2);
});

test('returning identities reuse rows; reduced/malformed catalogs cannot prune or partially import', async () => {
  provider.getLibraryCatalog.mockResolvedValue([{ external_id: externalId, name: 'Returned', media_type: 'movie' }]);
  expect((await reconcile()).libraries[0]).toMatchObject({ id: libraryId, name: 'Returned', is_active: false });
  provider.getLibraryCatalog.mockResolvedValue([{ external_id: 'valid', name: 'New', media_type: 'tv' }, {}]);
  await expect(reconcile()).rejects.toMatchObject({ code: 'library_catalog_invalid' });
  expect((await db.query('SELECT id FROM libraries WHERE media_server_id=$1', [sourceId])).rows).toEqual([{ id: libraryId }]);
  provider.getLibraryCatalog.mockResolvedValue([]);
  await reconcile();
  expect((await library()).name).toBe('Returned');
});

test('fresh installs import only supported libraries and do not sync disabled ones', async () => {
  provider.getLibraryCatalog.mockResolvedValue([{ external_id: externalId, name: 'Synthetic', media_type: 'movie' },
    { external_id: 'new', name: 'Music documentaries', media_type: 'tv' }, { external_id: 'audio', name: 'Audio', media_type: null }]);
  const syncLibrary = jest.fn().mockResolvedValue({ success: true });
  const result = await syncMediaServerLibraries({ db, getMediaServerServiceByType: resolveService,
    mediaSyncService: { syncLibrary }, logger: { info: jest.fn(), error: jest.fn() } });
  await Promise.resolve();
  expect(result.libraries).toHaveLength(2);
  expect(syncLibrary).toHaveBeenCalledTimes(1);
  expect(syncLibrary.mock.calls[0][0]).not.toBe(libraryId);
});

test.each(['source', 'library', 'items', 'visible'])('changed %s invalidates archive review', async change => {
  const preview = await read();
  if (change === 'source') await db.query("UPDATE media_server SET api_key='changed' WHERE id=$1", [sourceId]);
  if (change === 'library') await db.query("UPDATE libraries SET name='changed' WHERE id=$1", [libraryId]);
  if (change === 'items') await db.query("INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type) VALUES ($1,$2,'new','New','movie')", [sourceId, libraryId]);
  if (change === 'visible') provider.getLibraryCatalog.mockResolvedValue([{ external_id: externalId, name: 'Synthetic', media_type: null }]);
  await expect(confirm(preview)).rejects.toMatchObject({ status: 412 });
  expect((await library()).archived_at).toBeNull();
});

test('configuration changed during remote fetch never applies stale discovery', async () => {
  provider.getLibraryCatalog.mockImplementation(async () => {
    await db.query("UPDATE media_server SET api_key='changed' WHERE id=$1", [sourceId]);
    return [{ external_id: 'new', name: 'New', media_type: 'movie' }];
  });
  await expect(reconcile()).rejects.toMatchObject({ code: 'library_catalog_source_changed' });
  expect((await db.query('SELECT id FROM libraries WHERE media_server_id=$1', [sourceId])).rows).toEqual([{ id: libraryId }]);
});

test('active owners, unfinished markers, enabled libraries and revoked admins fail closed', async () => {
  const preview = await read();
  await createMediaSyncOwnership({ pool: db.pool })(libraryId, async () => {
    expect((await read()).reason).toBe('active_owner');
    await expect(confirm(preview)).rejects.toMatchObject({ status: 409 });
  });
  await db.query("INSERT INTO media_server_sync_status(media_server_id,library_id,sync_type,status) VALUES ($1,$2,'full','running')", [sourceId, libraryId]);
  const unfinished = await read();
  expect(unfinished.reason).toBe('unfinished_import');
  await expect(confirm(unfinished)).rejects.toMatchObject({ status: 409 });
  await db.query('DELETE FROM media_server_sync_status WHERE library_id=$1', [libraryId]);
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  expect((await read()).reason).toBe('disable_library');
  await db.query("UPDATE users SET role='user' WHERE id=$1", [actorId]);
  await expect(confirm(preview)).rejects.toMatchObject({ status: 403 });
  await expect(read()).rejects.toMatchObject({ status: 403 });
});

test('audit failure rolls back archive; competing confirmations commit only once', async () => {
  await db.query(`CREATE FUNCTION reject_synthetic_archive_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='library_archive_changed' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
  await db.query('CREATE TRIGGER reject_synthetic_archive_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_synthetic_archive_audit()');
  try {
    await expect(confirm(await read())).rejects.toThrow('synthetic audit failure');
    expect((await library()).archived_at).toBeNull();
  } finally {
    await db.query('DROP TRIGGER reject_synthetic_archive_audit ON audit_log');
    await db.query('DROP FUNCTION reject_synthetic_archive_audit()');
  }
  const preview = await read();
  const attempts = await Promise.allSettled([confirm(preview), confirm(preview)]);
  expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await db.query('SELECT count(*)::int AS n FROM audit_log WHERE user_id=$1', [actorId])).rows[0].n).toBe(1);
});

test('unattached running checkpoints block archive; retry-wait checkpoints are preserved', async () => {
  await db.query("INSERT INTO library_ingestion_state(library_id,run_id,phase) VALUES ($1,$2,'running')", [libraryId, randomUUID()]);
  expect((await read()).reason).toBe('unfinished_import');
  await db.query("UPDATE library_ingestion_state SET phase='retry_wait' WHERE library_id=$1", [libraryId]);
  await confirm(await read());
  expect((await db.query('SELECT phase FROM library_ingestion_state WHERE library_id=$1', [libraryId])).rows[0].phase).toBe('retry_wait');
  expect((await library()).archived_at).toBeTruthy();
});

test('receipts are scoped to actor, library, revision and operation', async () => {
  const preview = await read(), requestId = randomUUID();
  await confirm(preview, requestId);
  expect(await service.receipt(actorId, libraryId, randomUUID())).toEqual({ receipt: null });
  await expect(service.receipt(actorId, libraryId + 1, requestId)).rejects.toMatchObject({ status: 409 });
  await expect(confirm(await read(), requestId)).rejects.toMatchObject({ status: 409 });
  await db.query('UPDATE users SET is_active=false WHERE id=$1', [actorId]);
  await expect(service.receipt(actorId, libraryId, requestId)).rejects.toMatchObject({ status: 403 });
});

test('fresh snapshot installs the same archive constraints and receipt index as upgrades', async () => {
  // Exclusively owned disposable database; never load a snapshot into the application database.
  const container = await new PostgreSqlContainer('pgvector/pgvector:0.8.6-pg18')
    .withPassword(randomUUID()).withCommand(['postgres', '-c', 'shared_preload_libraries=pg_stat_statements']).start();
  let pool;
  try {
    await container.copyFilesToContainer([{ source: fileURLToPath(new URL('../../../../database/schema/current.sql', import.meta.url)), target: '/tmp/archive-schema.sql' }]);
    const loaded = await container.exec(['psql', '-v', 'ON_ERROR_STOP=1', '-U', container.getUsername(), '-d', container.getDatabase(), '-f', '/tmp/archive-schema.sql']);
    expect(loaded.exitCode).toBe(0);
    pool = new pg.Pool({ host: container.getHost(), port: container.getPort(), database: container.getDatabase(),
      user: container.getUsername(), password: container.getPassword() });
    const { rows: [fresh] } = await pool.query("INSERT INTO libraries(external_id,name,media_type,is_active,archived_at) VALUES ('synthetic','Synthetic','movie',false,NOW()) RETURNING id");
    await expect(pool.query('UPDATE libraries SET is_active=true WHERE id=$1', [fresh.id])).rejects.toMatchObject({ code: '23514' });
    const requestId = randomUUID();
    await pool.query("INSERT INTO audit_log(action,metadata) VALUES ('library_archive_changed',jsonb_build_object('requestId',$1::text))", [requestId]);
    await expect(pool.query("INSERT INTO audit_log(action,metadata) VALUES ('library_archive_changed',jsonb_build_object('requestId',$1::text))", [requestId])).rejects.toMatchObject({ code: '23505' });
    expect((await pool.query("SELECT filename FROM schema_migrations WHERE filename='20260928_010000_add_library_archive.sql'")).rows).toHaveLength(1);
    expect((await pool.query("SELECT filename FROM schema_migrations WHERE filename='20260928_020000_add_library_discovery_status.sql'")).rows).toHaveLength(1);
    const { rows: [source] } = await pool.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('jellyfin','Synthetic','http://synthetic.invalid','synthetic') RETURNING *");
    const repository = createLibraryDiscoveryStatusRepository(pool);
    await repository.finish(await repository.begin(source), { count: 2, contract: 'jellyfin_virtual_folders' });
    expect(await repository.read()).toMatchObject({ reason: 'complete', last_success_count: 2 });
    expect(await repository.read()).toMatchObject({ recovery_state: 'scheduled', automatic_attempts: 0, next_attempt_at: expect.any(Date) });
    expect((await pool.query("SELECT filename FROM schema_migrations WHERE filename='20260928_030000_add_library_catalog_recovery.sql'")).rows).toHaveLength(1);
    await pool.query("UPDATE media_server SET api_key='rotated' WHERE id=$1", [source.id]);
    const revision = await repository.read();
    expect([Number(revision.current_revision), Number(revision.source_revision)]).toEqual([2, 1]);
  } finally {
    try { await pool?.end(); } finally { await container.stop(); }
  }
});
