/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { withSourcePageFixtures } from '../helpers/sourcePageFixture.mjs';
import { resourceAdmissionFixture } from '../helpers/resourceAdmissionFixture.mjs';
import { reconcileMediaServerLibraries } from '../../services/mediaServerLibrarySync.mjs';
import { runLibraryCatalogRecovery } from '../../services/libraryCatalogRecovery.mjs';
import { createLibraryDiscoveryStatusRepository } from '../../services/libraryDiscoveryStatusRepository.mjs';
import { LIBRARY_CATALOG_LOCK, withLibraryCatalogSession } from '../../services/libraryCatalogSession.mjs';
import { getMediaServerService } from '../../services/mediaServers/index.mjs';
import { readInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
jest.unstable_mockModule('../../services/contentTypeAnalyzer.mjs', () => ({ contentTypeAnalyzer: { analyze: async () => ({ analyzed: false }) } }));
const { MediaSyncService } = await import('../../services/mediaSync.mjs');
const db = createIntegrationDatabaseModuleMock(), repository = createLibraryDiscoveryStatusRepository(db);
const logger = { debug: jest.fn() };
let server, url, sourceId, calls, respond;
const status = async () => (await db.query('SELECT * FROM media_server_catalog_status WHERE media_server_id=$1', [sourceId])).rows[0];
const due = () => db.query("UPDATE media_server_catalog_status SET next_attempt_at=clock_timestamp()-INTERVAL '1 second' WHERE media_server_id=$1 AND next_attempt_at IS NOT NULL", [sourceId]);
const automatic = () => runLibraryCatalogRecovery({ db, getMediaServerServiceByType: getMediaServerService, logger });
const manual = () => reconcileMediaServerLibraries({ db, getMediaServerServiceByType: getMediaServerService });
const send = (res, payload, code = 200, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(payload)); };
const catalog = provider => provider === 'plex' ? { MediaContainer: { size: 3, Directory: [
  { key: 'film', title: `Films ${sourceId}`, type: 'movie' }, { key: 'tv', title: `Shows ${sourceId}`, type: 'show' }, { key: 'audio', title: 'Audio', type: 'artist' },
] } } : provider === 'emby' ? { Items: catalog('jellyfin'), TotalRecordCount: 3 } : [
  { ItemId: 'film', Name: `Films ${sourceId}`, CollectionType: 'movies' }, { ItemId: 'tv', Name: `Shows ${sourceId}`, CollectionType: 'tvshows' }, { ItemId: 'audio', Name: 'Audio', CollectionType: 'music' },
];
beforeAll(async () => {
  server = createServer((req, res) => { calls++; respond(req, res); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); });
beforeEach(async () => {
  calls = 0; logger.debug.mockClear();
  respond = (_req, res) => send(res, {}, 503);
  await db.query('UPDATE media_server SET is_active=false');
  sourceId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('jellyfin',$1,$2,'synthetic') RETURNING id", [randomUUID(), url])).rows[0].id;
});
afterEach(async () => {
  await db.query('DELETE FROM media_server_sync_status WHERE media_server_id=$1', [sourceId]);
  await db.query('DELETE FROM libraries WHERE media_server_id=$1', [sourceId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [sourceId]);
});

test.each(['plex', 'emby', 'jellyfin'])('%s outage recovers through complete discovery and ingestion before handing off to backfill', async provider => {
  await db.query('UPDATE media_server SET type=$2 WHERE id=$1', [sourceId, provider]);
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  expect(await automatic()).toMatchObject({ deferred: true, reason: 'provider_unavailable' });
  expect(await status()).toMatchObject({ automatic_attempts: 1, recovery_state: 'scheduled', reason: 'provider_unavailable' });
  expect((await automatic()).reason).toBe('not_due');
  expect(calls).toBe(1);
  await due(); respond = (_req, res) => send(res, catalog(provider));
  const result = await automatic();
  expect(result.libraries.map(row => row.media_type).sort()).toEqual(['movie', 'tv']);
  expect(await status()).toMatchObject({ automatic_attempts: 0, recovery_state: 'scheduled', reason: 'complete', last_success_count: 2 });
  expect(await readInventoryBackgroundReadiness(db)).not.toBe('ready');
  const ingestion = new MediaSyncService({ resourceAdmission: resourceAdmissionFixture(), skipReporter: { report: async () => {} }, mediaServerServices: {
    getMediaServerService: async () => withSourcePageFixtures({
      getLibraryItems: async (_url, _key, id) => [{ external_id: 'item', tmdb_id: id === 'film' ? 1 : 2,
        title: 'Synthetic', media_type: id === 'film' ? 'movie' : 'tv', year: 2001 }],
      getCollections: async () => [],
    }),
  } });
  expect((await ingestion.syncLibrary(result.libraries[0].id)).success).toBe(true);
  expect(await readInventoryBackgroundReadiness(db)).not.toBe('ready');
  expect((await ingestion.syncLibrary(result.libraries[1].id)).success).toBe(true);
  expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
  const before = calls;
  expect((await automatic()).reason).toBe('not_due');
  expect(calls).toBe(before);
});

test.each([401, 403])('HTTP %i waits through restart and wakes only on changed configuration or manual retry', async code => {
  respond = (_req, res) => send(res, { secret: 'synthetic-key' }, code);
  await automatic();
  expect(await status()).toMatchObject({ automatic_attempts: 1, recovery_state: 'waiting_configuration', next_attempt_at: null });
  for (let i = 0; i < 3; i++) expect((await automatic()).reason).toBe('waiting_configuration');
  expect(calls).toBe(1);
  respond = (_req, res) => send(res, catalog('jellyfin'));
  await db.query("UPDATE media_server SET api_key='rotated' WHERE id=$1", [sourceId]);
  expect((await automatic()).libraries).toHaveLength(2);
  expect((await status()).automatic_attempts).toBe(0);
  await manual(); expect(calls).toBe(3);
});

test('five failed attempts enter sparse probes without losing automatic recovery or renewing the budget on restart', async () => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await due(); await automatic();
    expect((await status()).automatic_attempts).toBe(attempt);
  }
  const limited = await status();
  expect(limited.recovery_state).toBe('cooldown');
  expect(new Date(limited.next_attempt_at) - new Date(limited.finished_at)).toBeGreaterThanOrEqual(21599000);
  expect((await automatic()).reason).toBe('not_due'); expect(calls).toBe(5);
  await due(); await automatic();
  expect(await status()).toMatchObject({ automatic_attempts: 5, recovery_state: 'cooldown' });
  await due(); respond = (_req, res) => send(res, catalog('jellyfin'));
  expect((await automatic()).libraries).toHaveLength(2);
  expect(await status()).toMatchObject({ automatic_attempts: 0, reason: 'complete' });
});

test.each(['86400', '999999999999999999999999'])('Retry-After %s survives the adapter without leaking headers or shortening the pause', async value => {
  respond = (_req, res) => send(res, { secret: 'synthetic-key' }, 429, { 'Retry-After': value });
  await automatic(); const row = await status();
  expect(JSON.stringify(row)).not.toMatch(/synthetic-key|retry-after/);
  if (value === '86400') {
    expect(row.recovery_state).toBe('scheduled');
    expect(new Date(row.next_attempt_at) - new Date(row.finished_at)).toBeGreaterThanOrEqual(86399000);
  } else expect(row).toMatchObject({ recovery_state: 'needs_review', next_attempt_at: null });
  await automatic(); expect(calls).toBe(1);
});

test('fresh, disabled and unconfigured setups make no provider request or durable attempt', async () => {
  for (const sql of ["UPDATE media_server SET api_key='' WHERE id=$1", 'UPDATE media_server SET is_active=false WHERE id=$1']) {
    await db.query(sql, [sourceId]);
    expect((await automatic()).reason).toBe('not_configured');
    expect(await status()).toBeUndefined();
  }
  expect(calls).toBe(0);
});

test('manual and automatic scans share ownership; no competing attempt is recorded', async () => {
  let received; const started = new Promise(resolve => { received = resolve; });
  let finish;
  respond = (_req, res) => { finish = () => send(res, catalog('jellyfin')); received(); };
  const running = automatic(); await started;
  try {
    const active = await status();
    expect((await automatic()).reason).toBe('busy');
    await expect(manual()).rejects.toMatchObject({ code: 'library_catalog_busy' });
    expect((await status()).attempt_id).toBe(active.attempt_id);
    expect(calls).toBe(1);
  } finally { finish(); await running; }
});

test('crashed attempts retain budget and delay; age cannot bypass a live owner', async () => {
  const source = (await db.query('SELECT * FROM media_server WHERE id=$1', [sourceId])).rows[0];
  await repository.begin(source, { automatic: true });
  expect((await automatic()).reason).toBe('not_due'); expect(calls).toBe(0);
  await due();
  await db.withSessionAdvisoryLock(LIBRARY_CATALOG_LOCK, async () => {
    expect((await automatic()).reason).toBe('busy'); expect(calls).toBe(0);
  });
  await automatic(); expect((await status()).automatic_attempts).toBe(2);
});

test('a lost PostgreSQL owner cancels work; a new owner can safely acquire afterward', async () => {
  await expect(withLibraryCatalogSession(db.pool, async (owned, signal) => {
    const pid = (await owned.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const aborted = new Promise(resolve => { signal.addEventListener('abort', resolve, { once: true }); });
    await db.query('SELECT pg_terminate_backend($1)', [pid]); await aborted;
    await owned.query('SELECT 1');
  })).rejects.toBeInstanceOf(Error);
  expect(await withLibraryCatalogSession(db.pool, async () => 'new owner')).toBe('new owner');
});

test('invalid catalog preserves existing inventory and requires review without hot retry', async () => {
  respond = (_req, res) => send(res, catalog('jellyfin'));
  const { libraries } = await manual();
  await db.query("INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type) VALUES ($1,$2,'old','Synthetic','movie')", [sourceId, libraries[0].id]);
  await due(); respond = (_req, res) => send(res, { Items: [] });
  await automatic();
  expect(await status()).toMatchObject({ reason: 'invalid_catalog', recovery_state: 'needs_review' });
  const count = calls; await automatic(); expect(calls).toBe(count);
  expect((await db.query('SELECT external_id FROM media_server_items WHERE library_id=$1', [libraries[0].id])).rows).toEqual([{ external_id: 'old' }]);
});

test('upgrade adopts old diagnostics conservatively; fresh connections do not fabricate history', async () => {
  const migration = await readFile(new URL('../../../../database/migrations/20260928_030000_add_library_catalog_recovery.sql', import.meta.url), 'utf8');
  const rollback = new Error('rollback disposable upgrade fixture');
  await expect(db.withTransaction(async client => {
    await client.query('ALTER TABLE media_server_catalog_status DROP COLUMN automatic_attempts, DROP COLUMN recovery_state, DROP COLUMN next_attempt_at');
    await client.query(`INSERT INTO media_server_catalog_status(media_server_id,source_revision,attempt_id,started_at,finished_at,reason,contract)
      VALUES ($1,1,$2,clock_timestamp()-INTERVAL '1 day',clock_timestamp()-INTERVAL '1 day','timeout','unknown')`, [sourceId, randomUUID()]);
    await client.query(migration);
    const { rows: [row] } = await client.query('SELECT *,next_attempt_at>clock_timestamp()+INTERVAL \'5 hours\' AS delayed FROM media_server_catalog_status WHERE media_server_id=$1', [sourceId]);
    expect(row).toMatchObject({ automatic_attempts: 1, recovery_state: 'scheduled', delayed: true, last_success_at: null });
    throw rollback;
  })).rejects.toBe(rollback);
  expect(await status()).toBeUndefined();
});
