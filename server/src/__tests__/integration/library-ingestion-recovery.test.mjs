/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { resourceAdmissionFixture } from '../helpers/resourceAdmissionFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { sourcePageFixture, withSourcePageFixtures } from '../helpers/sourcePageFixture.mjs';
import { readPlexSourcePage } from '../../services/mediaServers/shared/sourcePage.mjs';
jest.unstable_mockModule('../../services/contentTypeAnalyzer.mjs', () => ({ contentTypeAnalyzer: { analyze: async () => ({ analyzed: false }) } }));
const { MediaSyncService } = await import('../../services/mediaSync.mjs');
const { createMediaSyncOwnership } = await import('../../services/mediaSyncOwnership.mjs');
const { MediaSourceObservationStore } = await import('../../services/mediaSourceObservationStore.mjs');
const { mediaSyncDatabase } = await import('../../services/mediaSyncDatabaseScope.mjs');
const { pruneMissingMediaItems, pruneMissingCollections } = await import('../../services/mediaSyncQueries.mjs');
const { MEDIA_SYNC_OWNER_LOCK } = await import('../../services/mediaSyncLockKeys.mjs');
const { LIBRARY_INGESTION_STATUS_SQL, LIBRARY_INGESTION_WATCHDOG_SQL } = await import('../../services/libraryIngestionStatus.mjs');
const { readInventoryBackgroundReadiness } = await import('../../services/inventoryBackgroundReadiness.mjs');
const db = createIntegrationDatabaseModuleMock();
let serverId, libraryId;
const item = id => ({ external_id: String(id), tmdb_id: id, title: `Synthetic ${id}`, media_type: 'movie', year: 2001 });
const state = async () => (await db.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [libraryId])).rows[0];
const inventory = async () => (await db.query('SELECT external_id FROM media_server_items WHERE library_id=$1 ORDER BY external_id', [libraryId])).rows.map(row => row.external_id);
const due = () => db.query("UPDATE library_ingestion_state SET retry_after=clock_timestamp()-interval '1 second' WHERE library_id=$1", [libraryId]);
function sync(getLibraryItems, overrides = {}, total) {
  return new MediaSyncService({ resourceAdmission: resourceAdmissionFixture(), mediaServerServices: { getMediaServerService: async () => withSourcePageFixtures({
    getLibraryItems, getCollections: async () => [],
  }, total) }, skipReporter: { report: async () => {} }, ...overrides });
}
const status = async () => (await db.query(`SELECT ${LIBRARY_INGESTION_STATUS_SQL} AS status FROM libraries l WHERE id=$1`, [libraryId])).rows[0].status;

beforeEach(async () => {
  serverId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://synthetic.invalid','synthetic') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,'synthetic','movie',$2,true) RETURNING id", [randomUUID(), serverId])).rows[0].id;
});
afterEach(async () => {
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM media_server_sync_status WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM libraries WHERE media_server_id=$1', [serverId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
});

test.each(['plex', 'emby', 'jellyfin'].flatMap(provider => ['movie', 'tv'].map(mediaType => [provider, mediaType])))
  ('%s %s legacy inventory is adopted, backfilled and completed once without erasing partial data', async (provider, mediaType) => {
    await db.query('UPDATE media_server SET type=$2 WHERE id=$1', [serverId, provider]);
    await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [libraryId, mediaType]);
    await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
    await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type)
      VALUES ($1,$2,'old','Synthetic legacy',$3)`, [serverId, libraryId, mediaType]);
    await db.query(`INSERT INTO media_server_sync_status(media_server_id,library_id,sync_type,status)
      VALUES ($1,$2,'full','completed')`, [serverId, libraryId]);
    expect(await state()).toBeUndefined();
    expect(await status()).toMatchObject({ state: 'awaiting_import', needsReconciliation: false });
    expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).toContain(libraryId);
    expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
    // The incremental entry path must not bypass full adoption or acknowledge partial history.
    const broken = sync(async () => { throw new Error('synthetic source unavailable'); });
    expect(await broken.syncLibrary(libraryId, { incremental: true })).toMatchObject({ deferred: true });
    expect(await inventory()).toEqual(['old']);
    expect(await state()).toMatchObject({ phase: 'retry_wait', attempt_count: 1, restart_count: 0 });
    expect((await db.query('SELECT sync_type FROM media_server_sync_status WHERE library_id=$1 ORDER BY id DESC LIMIT 1', [libraryId])).rows[0].sync_type).toBe('full');
    expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).not.toContain(libraryId);
    await due();
    expect(await sync(async () => [{ ...item(22), media_type: mediaType }]).syncLibrary(libraryId, { incremental: true }))
      .toMatchObject({ success: true, prunedItems: 1 });
    expect(await inventory()).toEqual(['22']);
    expect(await status()).toMatchObject({ state: 'complete' });
    expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
    expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).not.toContain(libraryId);
  });

test.each(['movie', 'tv'])('%s resource deferral preserves inventory, attempts and automatic eligibility', async mediaType => {
  await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [libraryId, mediaType]);
  await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type)
    VALUES ($1,$2,'old','Synthetic legacy',$3)`, [serverId, libraryId, mediaType]);
  let available = 0;
  const getLibraryItems = jest.fn(async () => [{ ...item(22), media_type: mediaType }]);
  const instance = sync(getLibraryItems, {
    resourceAdmission: resourceAdmissionFixture(() => ({ available, constrained: 2e9, total: 16e9 })),
  });
  expect(await instance.syncLibrary(libraryId)).toMatchObject({ deferred: true, reason: 'resource_memory_pressure' });
  expect(getLibraryItems).not.toHaveBeenCalled();
  expect(await inventory()).toEqual(['old']);
  expect(await state()).toBeUndefined();
  expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).toContain(libraryId);
  available = 1e9;
  expect(await instance.syncLibrary(libraryId)).toMatchObject({ success: true });
  expect(await inventory()).toEqual(['22']);
  expect(await state()).toMatchObject({ phase: 'complete', attempt_count: 1 });
});

test('a newer completed import cannot hide an older unfinished marker from learning or recovery', async () => {
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  await db.query(`INSERT INTO media_server_sync_status(media_server_id,library_id,sync_type,status,created_at)
    VALUES ($1,$2,'full','running',clock_timestamp()-interval '1 year')`, [serverId, libraryId]);
  expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
  expect(await status()).toMatchObject({ state: 'legacy_owner_unknown', needsReconciliation: true });
  expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).not.toContain(libraryId);
  expect(await sync(async () => []).syncLibrary(libraryId)).toMatchObject({ reason: 'legacy_owner_unknown' });
  expect(await inventory()).toEqual(['11']);
});

test('adoption waits for enabled configuration and ownership, and ignores music', async () => {
  const eligible = async () => (await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id);
  expect(await eligible()).toContain(libraryId);
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  expect(await status()).toMatchObject({ state: 'disabled' });
  expect(await eligible()).not.toContain(libraryId);
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  await db.query("UPDATE media_server SET api_key='' WHERE id=$1", [serverId]);
  expect(await status()).toMatchObject({ state: 'unconfigured' });
  expect(await eligible()).not.toContain(libraryId);
  await db.query("UPDATE media_server SET api_key='synthetic',is_active=false WHERE id=$1", [serverId]);
  expect(await status()).toMatchObject({ state: 'disabled' });
  expect(await eligible()).not.toContain(libraryId);
  await db.query('UPDATE media_server SET is_active=true WHERE id=$1', [serverId]);
  await createMediaSyncOwnership(db)(libraryId, async () => {
    expect(await status()).toMatchObject({ state: 'active' });
    expect(await eligible()).not.toContain(libraryId);
  });
  // Music is also excluded by the persisted library contract; do not weaken it
  // merely to construct a fixture. Runtime media admission has its own tests.
  await expect(db.query("UPDATE libraries SET media_type='music' WHERE id=$1", [libraryId]))
    .rejects.toMatchObject({ code: '23514' });
});

test('unowned and wrong-library helpers cannot change the capture lifecycle or prune inventory', async () => {
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  const store = new MediaSourceObservationStore(db);
  const capture = await createMediaSyncOwnership(db)(libraryId, () => store.start(serverId, libraryId));
  const callback = jest.fn();
  for (const mutation of [() => pruneMissingMediaItems(libraryId, []),
    () => store.start(serverId, libraryId, { source: 'local_capture' }),
    () => store.capture(capture, [item(99)]), () => store.withCurrentCapture(capture, callback),
    () => pruneMissingCollections(libraryId, []), () => store.finish(capture),
    () => store.finish(capture, { failed: true })]) {
    await expect(mutation()).rejects.toThrow('ingestion_ownership_required');
    await createMediaSyncOwnership(db)(libraryId + 1, async () => {
      await expect(mutation()).rejects.toThrow('ingestion_library_scope_mismatch');
    });
  }
  expect(callback).not.toHaveBeenCalled();
  expect(await inventory()).toEqual(['11']);
  expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows[0].phase).toBe('collecting');
});

test('controlled local capture keeps shared exclusion and can finish without claiming an ingestion run', async () => {
  const own = createMediaSyncOwnership(db);
  const store = new MediaSourceObservationStore(mediaSyncDatabase);
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  await own(libraryId, async () => {
    const older = await store.start(serverId, libraryId, { source: 'local_capture' });
    const current = await store.start(serverId, libraryId, { source: 'local_capture' });
    const competing = jest.fn();
    expect(await own(libraryId, competing)).toMatchObject({ deferred: true, reason: 'ingestion_owned' });
    expect(competing).not.toHaveBeenCalled();
    expect(await store.capture(older, [item(99)])).toBe(false);
    const staleCallback = jest.fn();
    expect(await store.withCurrentCapture(older, staleCallback)).toBe(false);
    expect(staleCallback).not.toHaveBeenCalled();
    expect(await store.capture(current, [item(11)])).toBe(true);
    expect(await store.finish(older)).toBe(false);
    expect(await store.finish(current)).toBe(true);
    expect(await store.capture(current, [item(99)])).toBe(false);
  });
  expect((await db.query('SELECT phase,source FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows[0])
    .toEqual({ phase: 'complete', source: 'local_capture' });
  expect(await state()).toBeUndefined();
  expect((await db.query('SELECT is_active FROM libraries WHERE id=$1', [libraryId])).rows[0].is_active).toBe(false);
});

test.each(['movie', 'tv'])('%s interrupted import replays from zero; late disconnected owner cannot overwrite it', async mediaType => {
  await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [libraryId, mediaType]);
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  const media = id => ({ ...item(id), media_type: mediaType });
  const paused = Promise.withResolvers(), resume = Promise.withResolvers();
  const first = sync(async (_url, _key, _id, { offset }) => {
    if (offset < 2) return [media(11 + offset)];
    paused.resolve();
    await resume.promise;
    return [media(99)];
  }, {}, 3);
  const old = first.syncLibrary(libraryId, { batchSize: 1 }).catch(error => error);
  await paused.promise;
  try {
    expect(await inventory()).toEqual(['11', '12']);
    expect(await status()).toMatchObject({ state: 'active', pages: 2, items: 2 });
    expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
    // A very old checkpoint is not permission to steal a live session.
    await db.query("UPDATE library_ingestion_state SET updated_at=NOW()-interval '1 year' WHERE library_id=$1", [libraryId]);
    const replacementPages = jest.fn(async (_url, _key, _id, { offset, limit }) => [media(22), media(11)].slice(offset, offset + limit));
    const replacement = sync(replacementPages, {}, 2);
    expect(await replacement.syncLibrary(libraryId)).toMatchObject({ deferred: true, reason: 'ingestion_owned' });
    expect(replacementPages).not.toHaveBeenCalled();
    const { rows: [lock] } = await db.query(`SELECT pid FROM pg_locks WHERE locktype='advisory' AND classid=$1::oid AND objid=$2::oid
      AND objsubid=2 AND granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`, [MEDIA_SYNC_OWNER_LOCK, libraryId]);
    // Only a synthetic suite's identified owning backend is terminated.
    await db.query('SELECT pg_terminate_backend($1,5000)', [lock.pid]);
    expect(await replacement.syncLibrary(libraryId)).toMatchObject({ deferred: true, reason: 'retry_wait' });
    expect(await status()).toMatchObject({ state: 'interrupted', pages: 2 });
    await due();
    expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).toContain(libraryId);
    expect(await replacement.syncLibrary(libraryId, { batchSize: 1, incremental: true })).toMatchObject({ success: true });
    expect(replacementPages.mock.calls.map(call => call[3].offset)).toEqual([0, 1]);
    expect(await inventory()).toEqual(['11', '22']);
    const completed = await state();
    expect(completed).toMatchObject({ phase: 'complete', restart_count: 1 });
    resume.resolve();
    expect(await old).toBeInstanceOf(Error);
    expect(await inventory()).toEqual(['11', '22']);
    expect(await state()).toEqual(completed);
    expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
  } finally { resume.resolve(); await old; }
});

test('failure preserves partial items and cooldown; completion prunes only after full replay', async () => {
  const first = sync(async (_u, _k, _l, { offset }) => {
    if (offset >= 2) throw new Error('synthetic offline');
    return [item(11 + offset)];
  }, {}, 3);
  await expect(first.syncLibrary(libraryId, { batchSize: 1 })).rejects.toThrow('synthetic offline');
  expect(await inventory()).toEqual(['11', '12']);
  expect(await state()).toMatchObject({ phase: 'retry_wait', pages_processed: 2 });
  expect(await first.syncLibrary(libraryId)).toMatchObject({ reason: 'retry_wait' });
  expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).not.toContain(libraryId);
  await due();
  expect(await sync(async () => [item(22)]).syncLibrary(libraryId)).toMatchObject({ success: true, prunedItems: 2 });
  expect(await inventory()).toEqual(['22']);
});

test.each([null, {}, 'malformed'])('malformed page %p never acts as an empty library', async page => {
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  await expect(sync(async () => page).syncLibrary(libraryId)).resolves.toMatchObject({ deferred: true, detail: 'invalid_response' });
  expect(await inventory()).toEqual(['11']);
  expect((await state()).phase).toBe('retry_wait');
});

test('failed finalization rolls back pruning, capture and completion together', async () => {
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  const broken = sync(async () => [item(22)]);
  broken.reconcileAwaitingDecisions = async () => { throw new Error('synthetic finalization failure'); };
  await expect(broken.syncLibrary(libraryId)).rejects.toThrow('synthetic finalization failure');
  expect(await inventory()).toEqual(['11', '22']);
  expect((await state()).phase).toBe('retry_wait');
  expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows[0].phase).toBe('failed');
});

test('owner lost during collection preflight cannot create a capture or prune through the pool', async () => {
  await sync(async () => [item(99)]).syncLibrary(libraryId);
  const interrupted = sync(async () => [item(11)], { mediaServerServices: { getMediaServerService: async () => ({
    getLibraryPage: async () => sourcePageFixture([item(11)]),
    getCollectionPage: async () => {
      const { rows: [lock] } = await db.query(`SELECT pid FROM pg_locks WHERE locktype='advisory'
        AND classid=$1::oid AND objid=$2::oid AND objsubid=2 AND granted
        AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`, [MEDIA_SYNC_OWNER_LOCK, libraryId]);
      // Terminate only this disposable suite's identified library owner, never a live backend.
      expect(lock?.pid).toBeGreaterThan(0);
      await db.query('SELECT pg_terminate_backend($1,5000)', [lock.pid]);
      return sourcePageFixture([]);
    },
  }) } });
  await expect(interrupted.syncLibrary(libraryId)).rejects.toThrow();
  expect(await inventory()).toEqual(['99']);
  expect((await state()).phase).toBe('running');
  expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows[0].phase).toBe('complete');
  await due();
  await expect(sync(async () => [item(22)]).syncLibrary(libraryId)).resolves.toMatchObject({ success: true, prunedItems: 1 });
  expect(await inventory()).toEqual(['22']);
  expect((await state()).phase).toBe('complete');
});

test('unknown legacy markers are preserved instead of age-based takeover', async () => {
  await db.query("INSERT INTO media_server_sync_status(media_server_id,library_id,sync_type,status) VALUES ($1,$2,'full','running')", [serverId, libraryId]);
  const pages = jest.fn();
  expect(await sync(pages).syncLibrary(libraryId)).toMatchObject({ reason: 'legacy_owner_unknown' });
  expect(pages).not.toHaveBeenCalled();
  expect(await state()).toBeUndefined();
  expect(await status()).toMatchObject({ state: 'legacy_owner_unknown', needsReconciliation: true });
  expect((await db.query('SELECT status FROM media_server_sync_status WHERE library_id=$1', [libraryId])).rows[0].status).toBe('running');
});

test('foreign work remains visible after a completed owned import and cannot starve the watchdog', async () => {
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  await db.query("INSERT INTO media_server_sync_status(media_server_id,library_id,sync_type,status) VALUES ($1,$2,'full','running')", [serverId, libraryId]);
  expect(await status()).toMatchObject({ state: 'legacy_owner_unknown' });
  await db.query("UPDATE library_ingestion_state SET phase='retry_wait',retry_after=clock_timestamp()-interval '1 second' WHERE library_id=$1", [libraryId]);
  expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).not.toContain(libraryId);
  expect(await sync(async () => []).syncLibrary(libraryId)).toMatchObject({ reason: 'legacy_owner_unknown' });
  expect(await inventory()).toEqual(['11']);
});

test('missing configuration and source keys never authorize acquisition or deletion', async () => {
  await db.query("UPDATE media_server SET api_key='' WHERE id=$1", [serverId]);
  const pages = jest.fn();
  expect(await sync(pages).syncLibrary(libraryId)).toMatchObject({ reason: 'source_unconfigured' });
  expect(await state()).toBeUndefined();
  expect(pages).not.toHaveBeenCalled();
  await db.query("UPDATE media_server SET api_key='synthetic' WHERE id=$1", [serverId]);
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  await expect(sync(async () => [{ ...item(22), external_id: null }]).syncLibrary(libraryId)).resolves.toMatchObject({ deferred: true, detail: 'invalid_response' });
  expect(await inventory()).toEqual(['11']);
  await db.query("UPDATE media_server SET api_key='' WHERE id=$1", [serverId]);
  expect(await status()).toMatchObject({ state: 'unconfigured' });
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  expect(await status()).toMatchObject({ state: 'disabled' });
});

test('source changes during a provider call prevent pruning and completion', async () => {
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  const changed = sync(async () => {
    await db.query("UPDATE libraries SET external_id='changed' WHERE id=$1", [libraryId]);
    return [];
  });
  await expect(changed.syncLibrary(libraryId)).rejects.toThrow('ingestion_source_changed');
  expect(await inventory()).toEqual(['11']);
  expect((await state()).phase).toBe('retry_wait');
});

test('disabled sources do not create durable work and music libraries cannot enter storage', async () => {
  const pages = jest.fn();
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  expect(await sync(pages).syncLibrary(libraryId)).toMatchObject({ reason: 'source_disabled' });
  await expect(db.query("UPDATE libraries SET is_active=true,media_type='music' WHERE id=$1", [libraryId])).rejects.toMatchObject({ code: '23514' });
  expect(await state()).toBeUndefined();
  expect(pages).not.toHaveBeenCalled();
});

test('global slots limit active ingestion to two without consuming durable attempts', async () => {
  const ids = [libraryId];
  for (let i = 0; i < 2; i++) ids.push((await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id) VALUES ($1,$1,'movie',$2) RETURNING id", [randomUUID(), serverId])).rows[0].id);
  const own = createMediaSyncOwnership({ pool: db.pool });
  await own(ids[0], async () => own(ids[1], async () => {
    const callback = jest.fn();
    expect(await own(ids[2], callback)).toMatchObject({ reason: 'ingestion_capacity' });
    expect(callback).not.toHaveBeenCalled();
  }));
  expect(await own(ids[2], async () => 'released')).toBe('released');
});

test('fresh setup learning stays dormant until configured, populated and ingestion-complete', async () => {
  await db.query('UPDATE ai_provider_config SET rag_enabled=false WHERE id=1');
  expect(await readInventoryBackgroundReadiness(db)).toBe('disabled');
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  expect(await readInventoryBackgroundReadiness(db)).toBe('waiting_for_libraries');
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  expect(await readInventoryBackgroundReadiness(db)).toBe('waiting_for_inventory');
  await expect(sync(async () => { throw new Error('synthetic offline'); }).syncLibrary(libraryId)).resolves.toMatchObject({ reason: 'source_preflight_unavailable' });
  expect((await db.query('SELECT * FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows).toEqual([]);
  expect(await inventory()).toEqual([]);
  const attempt = (await db.query('SELECT status,error_message FROM media_server_sync_status WHERE library_id=$1', [libraryId])).rows[0];
  expect(attempt).toMatchObject({ status: 'failed', error_message: expect.stringContaining('Source preflight unavailable (media:unavailable)') });
  expect(attempt.error_message).not.toContain('synthetic offline');
  expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
  await due();
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
});

test('passing samples never authorize completion when a later page is truncated', async () => {
  await sync(async () => [item(99)]).syncLibrary(libraryId);
  const broken = sync(null, { mediaServerServices: { getMediaServerService: async () => ({
    getLibraryPage: async (_u, _k, _l, { offset }) => sourcePageFixture(offset < 2 ? [item(11 + offset)] : [], { offset, total: 3 }),
    getCollectionPage: async () => sourcePageFixture([]),
  }) } });
  expect(await broken.syncLibrary(libraryId)).toMatchObject({ reason: 'source_enumeration_incomplete', detail: 'premature_empty_page' });
  expect(await inventory()).toEqual(['11', '12', '99']);
  expect(await state()).toMatchObject({ phase: 'retry_wait' });
  expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows[0].phase).toBe('failed');
});

test.each(['short', 'repeated', 'changed_total', 'missing_total', 'collections', 'malformed'])('incomplete %s response preserves data and learning deferral, then safely replays', async fault => {
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  await db.query("INSERT INTO media_server_collections(media_server_id,library_id,external_id,name) VALUES ($1,$2,'old-set','Synthetic')", [serverId, libraryId]);
  const pages = jest.fn(async (_url, _key, _id, { offset }) => {
    if (fault === 'malformed') return readPlexSourcePage({ data: { MediaContainer: {} } });
    const total = fault === 'missing_total' ? null : fault === 'collections' ? 1 : 2;
    if (offset === 0) return sourcePageFixture([item(22)], { total, offset });
    if (fault === 'short' || fault === 'missing_total') return sourcePageFixture([], { total, offset });
    return sourcePageFixture([item(fault === 'repeated' ? 22 : 33)], { total: fault === 'changed_total' ? 3 : total, offset });
  });
  const broken = sync(null, { mediaServerServices: { getMediaServerService: async () => ({
    getLibraryPage: pages,
    getCollectionPage: async () => readPlexSourcePage({ data: {} }),
  }) } });
  expect(await broken.syncLibrary(libraryId)).toMatchObject({ deferred: true, reason: 'source_preflight_unavailable' });
  expect(await inventory()).toContain('11');
  expect((await db.query('SELECT external_id FROM media_server_collections WHERE library_id=$1', [libraryId])).rows).toEqual([{ external_id: 'old-set' }]);
  expect(await state()).toMatchObject({ phase: 'retry_wait' });
  expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [libraryId])).rows[0].phase).toBe('complete');
  expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
  expect(await broken.syncLibrary(libraryId)).toMatchObject({ reason: 'retry_wait' });
  if (fault === 'short') expect(pages.mock.calls.map(call => call[3].offset)).toEqual([0, 1]);
  await due();
  expect(await sync(async () => [item(33)]).syncLibrary(libraryId, { incremental: true })).toMatchObject({ success: true, prunedCollections: 1 });
  expect(await inventory()).toEqual(['33']);
  expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
});

test('server-sized media and collection pages complete with exact unique counts, including an empty replay', async () => {
  const offsets = [], collectionOffsets = [];
  const service = sync(null, { mediaServerServices: { getMediaServerService: async () => ({
    getLibraryPage: async (_u, _k, _l, { offset }) => {
      offsets.push(offset);
      return sourcePageFixture([item(11 + offset)], { offset, total: 3 });
    },
    getCollectionPage: async (_u, _k, _l, { offset }) => {
      collectionOffsets.push(offset);
      return sourcePageFixture([{ external_id: `set-${offset}`, name: 'Synthetic' }], { offset, total: 2 });
    },
  }) } });
  expect(await service.syncLibrary(libraryId, { batchSize: 100 })).toMatchObject({ success: true, totalItems: 3, collections: 2 });
  expect(offsets).toEqual([0, 1, 2]);
  expect(collectionOffsets).toEqual([0, 1]);
  expect(await state()).toMatchObject({ phase: 'complete', items_total: 3 });
  expect(await sync(async () => []).syncLibrary(libraryId)).toMatchObject({ success: true, prunedItems: 3, prunedCollections: 2 });
  expect(await inventory()).toEqual([]);
});
