/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { readInventoryBackgroundReadiness, withInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
import { INGESTION_OWNER_ACTIVE_SQL } from '../../services/libraryIngestionPredicates.mjs';
import { LIBRARY_INGESTION_WATCHDOG_SQL } from '../../services/libraryIngestionStatus.mjs';
import { readLibraryProfileRefreshStatus } from '../../services/libraryProfileRefreshStatus.mjs';
import { createJellyfinRecoveryFixture } from './helpers/jellyfinRecoveryFixture.mjs';
import { startIngestionProcess, eventually } from './helpers/ingestionProcess.mjs';
import { createInventoryRecoveryBackfill } from './helpers/inventoryRecoveryBackfill.mjs';

const db = createIntegrationDatabaseModuleMock();
const state = async id => (await db.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [id])).rows[0];
const due = id => db.query("UPDATE library_ingestion_state SET retry_after=clock_timestamp()-interval '1 second' WHERE library_id=$1", [id]);
const owned = async id => (await db.query(`SELECT ${INGESTION_OWNER_ACTIVE_SQL} AS owned FROM libraries l WHERE id=$1`, [id])).rows[0].owned;
const inventory = async id => (await db.query('SELECT external_id FROM media_server_items WHERE library_id=$1 ORDER BY external_id', [id])).rows.map(row => row.external_id);
const collections = async id => (await db.query('SELECT external_id FROM media_server_collections WHERE library_id=$1 ORDER BY external_id', [id])).rows.map(row => row.external_id);
const watchdog = async () => (await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id);

test('real Jellyfin ingestion processes recover outage and abrupt media/collection crashes before backfill and learning', async () => {
  const fixture = await createJellyfinRecoveryFixture();
  const children = [];
  async function start() {
    const child = startIngestionProcess(getPool().options, fixture.origin);
    children.push(child); await child.ready(); return child;
  }
  let evaluationCalls = 0;
  const learning = withInventoryBackgroundReadiness({
    run: async () => { evaluationCalls++; return { status: 'invoked' }; }, stop() {},
  }, db);
  async function deferred(reason) {
    expect(await learning.run()).toEqual({ status: 'deferred', reason });
    expect(evaluationCalls).toBe(0);
  }
  try {
    await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
    await db.query('UPDATE media_server SET is_active=false');
    await db.query('UPDATE libraries SET is_active=false');
    await deferred('waiting_for_libraries');
    const sourceId = (await db.query(`INSERT INTO media_server(type,name,url,api_key)
      VALUES ('jellyfin',$1,$2,'synthetic-only') RETURNING id`, [randomUUID(), fixture.origin])).rows[0].id;
    const libraries = [];
    for (const type of ['movie', 'tv']) {
      const key = randomUUID();
      const id = (await db.query(`INSERT INTO libraries(media_server_id,external_id,name,media_type)
        VALUES ($1,$2,$3,$4) RETURNING id`, [sourceId, key, randomUUID(), type])).rows[0].id;
      fixture.libraries.set(key, type); libraries.push({ id, key, type });
      // A populated legacy library is not proof of completed ingestion.
      await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,tmdb_id,last_synced)
        VALUES ($1,$2,$3,'Legacy item',$4,999,now()-interval '1 day')`, [sourceId, id, `${key}-legacy`, type]);
      await db.query(`INSERT INTO media_server_collections(media_server_id,library_id,external_id,name,last_synced)
        VALUES ($1,$2,$3,'Legacy collection',now()-interval '1 day')`, [sourceId, id, `${key}-legacy`]);
    }
    await deferred('ingesting');
    const first = await start();
    expect(await first.sync(libraries[0].id)).toMatchObject({ reason: 'source_content_cooldown' });
    expect(fixture.requests).toHaveLength(1);
    // Give a loaded CI runner headroom: test persisted waits, not wall-clock
    // speed. The production delay calculation has separate policy coverage.
    await db.query("UPDATE media_source_content_circuits SET next_attempt_at=clock_timestamp()+interval '10 minutes' WHERE media_server_id=$1", [sourceId]);
    await first.kill();

    let worker = await start();
    const circuitBefore = (await db.query('SELECT * FROM media_source_content_circuits WHERE media_server_id=$1', [sourceId])).rows[0];
    expect(circuitBefore).toMatchObject({ state: 'open', attempts: 1 });
    expect(await worker.sync(libraries[1].id)).toMatchObject({ reason: 'source_content_cooldown' });
    expect(fixture.requests).toHaveLength(1);
    for (const library of libraries) expect(await watchdog()).not.toContain(library.id);
    await deferred('ingesting');
    // Test-only clock advancement, after proving restart cannot bypass the wait.
    await db.query("UPDATE media_source_content_circuits SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE media_server_id=$1", [sourceId]);
    await due(libraries[0].id);
    fixture.recover();

    for (const library of libraries) {
      const { id, key, type } = library;
      // Kill after committed media pages for movies and after committed collection
      // pages for TV. Preflight/canary requests (limit=2) remain healthy.
      fixture.block(key, type === 'tv');
      // Observe the deliberate crash immediately, then assert it after killing;
      // never leave an unhandled rejection between the barrier and the assertion.
      const importing = worker.sync(id).then(result => ({ result }), error => ({ error }));
      await eventually(() => fixture.blocked, `${type} page barrier`);
      const before = await state(id);
      expect(before.phase).toBe('running');
      expect(before.items_processed).toBe(type === 'movie' ? 2 : 5);
      expect(await inventory(id)).toContain(`${key}-legacy`);
      expect(await collections(id)).toContain(`${key}-legacy`);
      expect(await owned(id)).toBe(true);
      expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [id])).rows[0].phase).toBe('collecting');
      await deferred('ingesting');

      const contender = await start();
      const calls = fixture.requests.length;
      await due(id); // Expired retry time is never authority to steal a live lock.
      expect(await contender.sync(id)).toMatchObject({ reason: 'ingestion_owned' });
      expect(fixture.requests).toHaveLength(calls);
      await db.query("UPDATE library_ingestion_state SET retry_after=clock_timestamp()+interval '10 minutes' WHERE library_id=$1", [id]);
      await worker.kill();
      expect((await importing).error?.message).toBe('ingestion_fixture_exited');
      await eventually(async () => !await owned(id), 'dead session lock release');
      // No JavaScript finalizer ran: the checkpoint, capture and run identity remain.
      expect(await state(id)).toMatchObject({ run_id: before.run_id, phase: 'running', items_processed: before.items_processed });
      expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [id])).rows[0].phase).toBe('collecting');
      worker = contender;
      expect(await worker.sync(id)).toMatchObject({ reason: 'retry_wait' });
      expect(fixture.requests).toHaveLength(calls);
      expect(await watchdog()).not.toContain(id);
      await deferred('ingesting');
      await due(id);
      expect(await watchdog()).toContain(id);
      fixture.unblock();
      const replayStart = fixture.requests.length;
      expect(await worker.sync(id)).toMatchObject({ success: true, totalItems: 5, ignoredItems: 1, collections: 3,
        prunedItems: 1, prunedCollections: 1 });
      expect(fixture.requests[replayStart]).toMatchObject({ key, offset: 0, collections: false });
      const after = await state(id);
      expect(after).toMatchObject({ phase: 'complete', retry_after: null, restart_count: before.restart_count + 1 });
      expect(after.run_id).not.toBe(before.run_id);
      expect((await db.query('SELECT status FROM media_server_sync_status WHERE id=$1', [before.sync_status_id])).rows[0].status).toBe('failed');
      expect((await db.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [id])).rows[0].phase).toBe('complete');
      expect(await inventory(id)).toEqual(Array.from({ length: 4 }, (_, i) => `${key}-${i}`));
      expect(await collections(id)).toEqual(Array.from({ length: 3 }, (_, i) => `${key}-collection-${i}`));
      if (type === 'movie') await deferred('ingesting');
    }

    // Music libraries are rejected by the schema; stray Audio rows in supported
    // library responses were ignored above, even though the provider returned them.
    await expect(db.query(`INSERT INTO libraries(media_server_id,external_id,name,media_type)
      VALUES ($1,$2,'Unsupported library','music')`, [sourceId, randomUUID()])).rejects.toMatchObject({ code: '23514' });
    expect((await db.query('SELECT count(*)::integer AS count FROM media_source_observations WHERE external_id LIKE $1', ['%-audio'])).rows[0].count).toBe(0);
    expect((await db.query('SELECT state,attempts FROM media_source_content_circuits WHERE media_server_id=$1', [sourceId])).rows[0])
      .toEqual({ state: 'closed', attempts: 0 });

    await db.query("INSERT INTO tmdb_config(api_key,is_active) VALUES ('synthetic-only',true)");
    const backfill = createInventoryRecoveryBackfill(db);
    expect(await backfill.queue.refillQueue()).toMatchObject({ queued: 8 });
    await deferred('backfilling');
    for (let item = 0; item < 8; item++) {
      await backfill.processNext();
      if (item < 7) await deferred('backfilling');
    }
    expect(backfill.providerCalls).toBe(8);
    expect(backfill.routingCalls).toBe(0);
    expect(await backfill.queue.refillQueue()).toMatchObject({ queued: 0 });
    let statuses;
    for (let tick = 0; tick < 4; tick++) {
      expect(await backfill.refreshProfiles()).toMatchObject({ failed: 0, retried: 0 });
      statuses = (await readLibraryProfileRefreshStatus(db)).libraries.filter(row => libraries.some(l => l.id === row.libraryId));
      if (statuses.every(row => row.statusId === 'current')) break;
    }
    expect(statuses).toHaveLength(2);
    for (const status of statuses) {
      expect(status.statusId).toBe('current');
      expect(status.profileRevision).toBe(status.sourceRevision);
      expect(status.acknowledgedRevision).toBe(status.sourceRevision);
    }
    const profiles = (await db.query('SELECT item_count,observation_summary FROM library_profiles WHERE library_id=ANY($1)',
      [libraries.map(row => row.id)])).rows;
    expect(profiles).toHaveLength(2);
    for (const profile of profiles) {
      expect(profile.item_count).toBe(4);
      expect(profile.observation_summary.traits.keywords.observedCount).toBe(4);
    }
    const tasks = (await db.query('SELECT task_type,status FROM task_queue')).rows;
    expect(tasks).toHaveLength(8);
    expect(tasks.every(task => task.task_type === 'metadata_enrichment' && task.status === 'completed')).toBe(true);
    expect((await db.query('SELECT DISTINCT method FROM classification_history')).rows).toEqual([{ method: 'source_library' }]);
    expect(await readInventoryBackgroundReadiness(db)).toBe('ready');
    expect(await learning.run()).toEqual({ status: 'invoked' });
    expect(evaluationCalls).toBe(1);
  } finally {
    learning.stop();
    try { await Promise.all(children.map(child => child.kill())); }
    finally { await fixture.close(); }
  }
});

test('process fixture rejects application databases before spawning', () => {
  expect(() => startIngestionProcess({ ...getPool().options, database: 'classifarr' }, 'http://127.0.0.1:1'))
    .toThrow('isolated_ingestion_fixture_required');
});
