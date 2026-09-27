/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
jest.unstable_mockModule('../../services/contentTypeAnalyzer.mjs', () => ({ contentTypeAnalyzer: { analyze: async () => ({ analyzed: false }) } }));
const { MediaSyncService } = await import('../../services/mediaSync.mjs');
const { createMediaSyncOwnership } = await import('../../services/mediaSyncOwnership.mjs');
const { MEDIA_SYNC_OWNER_LOCK } = await import('../../services/mediaSyncLockKeys.mjs');
const { LIBRARY_INGESTION_STATUS_SQL, LIBRARY_INGESTION_WATCHDOG_SQL } = await import('../../services/libraryIngestionStatus.mjs');
const { readInventoryBackgroundReadiness } = await import('../../services/inventoryBackgroundReadiness.mjs');
const db = createIntegrationDatabaseModuleMock();
let serverId, libraryId;
const item = id => ({ external_id: String(id), tmdb_id: id, title: `Synthetic ${id}`, media_type: 'movie', year: 2001 });
const state = async () => (await db.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [libraryId])).rows[0];
const inventory = async () => (await db.query('SELECT external_id FROM media_server_items WHERE library_id=$1 ORDER BY external_id', [libraryId])).rows.map(row => row.external_id);
const due = () => db.query("UPDATE library_ingestion_state SET retry_after=clock_timestamp()-interval '1 second' WHERE library_id=$1", [libraryId]);
function sync(getLibraryItems, overrides = {}) {
  return new MediaSyncService({ mediaServerServices: { getMediaServerService: async () => ({
    getLibraryItems, getCollections: async () => [],
  }) }, skipReporter: { report: async () => {} }, ...overrides });
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

test.each(['movie', 'tv'])('%s interrupted import replays from zero; late disconnected owner cannot overwrite it', async mediaType => {
  await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [libraryId, mediaType]);
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  const media = id => ({ ...item(id), media_type: mediaType });
  const paused = Promise.withResolvers(), resume = Promise.withResolvers();
  const first = sync(async (_url, _key, _id, { offset }) => {
    if (!offset) return [media(11)];
    paused.resolve();
    await resume.promise;
    return [media(99)];
  });
  const old = first.syncLibrary(libraryId, { batchSize: 1 }).catch(error => error);
  await paused.promise;
  try {
    expect(await inventory()).toEqual(['11']);
    expect(await status()).toMatchObject({ state: 'active', pages: 1, items: 1 });
    expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
    // A very old checkpoint is not permission to steal a live session.
    await db.query("UPDATE library_ingestion_state SET updated_at=NOW()-interval '1 year' WHERE library_id=$1", [libraryId]);
    const replacementPages = jest.fn(async (_url, _key, _id, { offset, limit }) => [media(22), media(11)].slice(offset, offset + limit));
    const replacement = sync(replacementPages);
    expect(await replacement.syncLibrary(libraryId)).toMatchObject({ deferred: true, reason: 'ingestion_owned' });
    expect(replacementPages).not.toHaveBeenCalled();
    const { rows: [lock] } = await db.query(`SELECT pid FROM pg_locks WHERE locktype='advisory' AND classid=$1::oid AND objid=$2::oid
      AND objsubid=2 AND granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`, [MEDIA_SYNC_OWNER_LOCK, libraryId]);
    // Only a synthetic suite's identified owning backend is terminated.
    await db.query('SELECT pg_terminate_backend($1,5000)', [lock.pid]);
    expect(await replacement.syncLibrary(libraryId)).toMatchObject({ deferred: true, reason: 'retry_wait' });
    expect(await status()).toMatchObject({ state: 'interrupted', pages: 1 });
    await due();
    expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).toContain(libraryId);
    expect(await replacement.syncLibrary(libraryId, { batchSize: 1, incremental: true })).toMatchObject({ success: true });
    expect(replacementPages.mock.calls.map(call => call[3].offset)).toEqual([0, 1, 2]);
    expect(await inventory()).toEqual(['11', '22']);
    const completed = await state();
    expect(completed).toMatchObject({ phase: 'complete', restart_count: 1 });
    resume.resolve();
    expect(await old).toBeInstanceOf(Error);
    expect(await inventory()).toEqual(['11', '22']);
    expect(await state()).toEqual(completed);
    expect(await readInventoryBackgroundReadiness(db)).toBe('ready');
  } finally { resume.resolve(); await old; }
});

test('failure preserves partial items and cooldown; completion prunes only after full replay', async () => {
  const first = sync(async (_u, _k, _l, { offset }) => {
    if (offset) throw new Error('synthetic offline');
    return [item(11)];
  });
  await expect(first.syncLibrary(libraryId, { batchSize: 1 })).rejects.toThrow('synthetic offline');
  expect(await inventory()).toEqual(['11']);
  expect(await state()).toMatchObject({ phase: 'retry_wait', pages_processed: 1 });
  expect(await first.syncLibrary(libraryId)).toMatchObject({ reason: 'retry_wait' });
  expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).not.toContain(libraryId);
  await due();
  expect(await sync(async () => [item(22)]).syncLibrary(libraryId)).toMatchObject({ success: true, prunedItems: 1 });
  expect(await inventory()).toEqual(['22']);
});

test.each([null, {}, 'malformed'])('malformed page %p never acts as an empty library', async page => {
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  await expect(sync(async () => page).syncLibrary(libraryId)).rejects.toThrow('ingestion_page_invalid');
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

test('unknown legacy markers are preserved instead of age-based takeover', async () => {
  await db.query("INSERT INTO media_server_sync_status(media_server_id,library_id,sync_type,status) VALUES ($1,$2,'full','running')", [serverId, libraryId]);
  const pages = jest.fn();
  expect(await sync(pages).syncLibrary(libraryId)).toMatchObject({ reason: 'legacy_owner_unknown' });
  expect(pages).not.toHaveBeenCalled();
  expect(await state()).toBeUndefined();
  expect(await status()).toEqual({ state: 'legacy_owner_unknown' });
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
  await expect(sync(async () => [{ ...item(22), external_id: null }]).syncLibrary(libraryId)).rejects.toThrow('ingestion_source_key_invalid');
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
  await expect(sync(async () => { throw new Error('synthetic offline'); }).syncLibrary(libraryId)).rejects.toThrow('synthetic offline');
  expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
  await due();
  await sync(async () => [item(11)]).syncLibrary(libraryId);
  expect(await readInventoryBackgroundReadiness(db)).toBe('ready');
});
