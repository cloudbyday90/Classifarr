/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { getPool } from './setup.mjs';
import { MediaSourceObservationStore } from '../../services/mediaSourceObservationStore.mjs';
import { createMediaSyncRecoveryWorkflow } from '../../services/mediaSyncRecoveryWorkflow.mjs';
import { createMediaSyncIdentityRecovery } from '../../services/mediaSyncIdentityRecovery.mjs';
import { claimSyncIdentityRecovery, persistRecoveredSyncItem, readSyncIdentityRecoveryPriority } from '../../services/mediaSyncIdentityRecoveryPersistence.mjs';
import { sourceIdentityRecoveryEvidence } from '../../services/sourceIdentityRecoveryEvidence.mjs';

function observationStore(pool) {
  return new MediaSourceObservationStore({ withTransaction: async fn => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } });
}
function fixture(index, mediaType = 'movie') {
  const item = { external_id: String(index).padStart(4, '0'), title: 'Fixture', year: 2001, media_type: mediaType,
    provider_identity_invalid: true, provider_identity_issue: 'conflicting_provider_ids' };
  item.source_identity_evidence = sourceIdentityRecoveryEvidence(item, 'library-1', { tmdb_id: [11, 22], imdb_id: ['tt123'], tvdb_id: [] });
  return item;
}
async function seed(pool, mediaType = 'movie') {
  const serverId = (await pool.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://fixture.invalid','fixture') RETURNING id", [randomUUID()])).rows[0].id;
  const libraryId = (await pool.query('INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,$2,$3,$4,true) RETURNING id', [randomUUID(), 'library-1', mediaType, serverId])).rows[0].id;
  return { serverId, libraryId };
}
async function cleanup(pool, serverId) {
  await pool.query('DELETE FROM media_server_items WHERE media_server_id=$1', [serverId]);
  await pool.query('DELETE FROM libraries WHERE media_server_id=$1', [serverId]);
  await pool.query('DELETE FROM media_server WHERE id=$1', [serverId]);
}
function workflow(store, context) {
  const provider = jest.fn().mockRejectedValue(new Error('synthetic provider outage'));
  const persistRecovery = jest.fn();
  const plan = createMediaSyncRecoveryWorkflow({ store, context,
    recovery: createMediaSyncIdentityRecovery({ tmdbService: { findIdentityByExternalId: provider } }),
    source: { libraryKey: 'library-1', service: { getLibraryItemIdentityEvidence: jest.fn() } },
    upsert: jest.fn(), persistRecovery, logger: { warn: jest.fn() },
  });
  return { plan, provider, persistRecovery };
}

test.each(['movie', 'tv'])('real PostgreSQL claims cover all 100 %s items across 13 paginated outage scans', async mediaType => {
  const pool = getPool(); const { serverId, libraryId } = await seed(pool, mediaType);
  const items = Array.from({ length: 100 }, (_, index) => fixture(index, mediaType));
  try {
    let requests = 0;
    for (let cycle = 0; cycle < 13; cycle++) {
      // Move only the eligibility boundary: production still reads the actual database clock.
      await pool.query("UPDATE media_source_observations SET recovery_retry_after=clock_timestamp()-INTERVAL '1 second' WHERE library_id=$1", [libraryId]);
      const store = observationStore(pool); // No in-memory scheduling state survives a cycle.
      const context = await store.start(serverId, libraryId);
      const { plan, provider, persistRecovery } = workflow(store, context);
      let completed = 0;
      for (let offset = 0; offset < items.length; offset += 10) {
        const page = items.slice(offset, offset + 10);
        await store.capture(context, page);
        for (const item of page) completed += await plan.process(item);
        expect(plan.pendingCount).toBeLessThanOrEqual(8);
        expect(provider).not.toHaveBeenCalled();
      }
      completed += await plan.flush();
      expect(completed).toBe(100);
      expect(provider).toHaveBeenCalledTimes(8);
      expect(persistRecovery).not.toHaveBeenCalled();
      requests += provider.mock.calls.length;
      await store.finish(context);
      const attempted = (await pool.query('SELECT count(*)::int n FROM media_source_observations WHERE library_id=$1 AND recovery_attempted_at IS NOT NULL', [libraryId])).rows[0].n;
      expect(attempted).toBe(Math.min(100, (cycle + 1) * 8));
    }
    expect(requests).toBe(104);
    expect((await pool.query("SELECT count(*)::int n FROM media_source_observations WHERE library_id=$1 AND recovery_outcome='provider_unavailable'", [libraryId])).rows[0].n).toBe(100);
    expect((await pool.query('SELECT id FROM media_server_items WHERE library_id=$1', [libraryId])).rowCount).toBe(0);
  } finally { await cleanup(pool, serverId); }
});

test.each(['inactive', 'changed', 'superseded', 'claimed', 'deleted'])('planning does not authorize a later %s candidate', async change => {
  const pool = getPool(); const { serverId, libraryId } = await seed(pool);
  try {
    const store = observationStore(pool); const context = await store.start(serverId, libraryId); const item = fixture(0);
    await store.capture(context, [item]);
    expect(await readSyncIdentityRecoveryPriority(store, context, item)).toEqual({ attemptedAt: null });
    const { plan, provider } = workflow(store, context);
    await plan.process(item);
    if (change === 'inactive') await pool.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
    if (change === 'changed') await pool.query("UPDATE media_source_observations SET source_digest=repeat('0',64) WHERE library_id=$1", [libraryId]);
    if (change === 'superseded') await store.start(serverId, libraryId);
    if (change === 'claimed') expect(await claimSyncIdentityRecovery(store, context, item)).toBe(true);
    if (change === 'deleted') await pool.query('DELETE FROM media_source_observations WHERE library_id=$1', [libraryId]);
    expect(await readSyncIdentityRecoveryPriority(store, context, item)).toBeNull();
    expect(await plan.flush()).toBe(1);
    expect(provider).not.toHaveBeenCalled();
  } finally { await cleanup(pool, serverId); }
});

test.each(['movie', 'tv'])('streamed %s repair commits only fresh proof and reuses its receipt on the next scan', async mediaType => {
  const pool = getPool(); const { serverId, libraryId } = await seed(pool, mediaType);
  const items = [fixture(0, mediaType), fixture(1, mediaType)];
  const tmdbService = {
    findIdentityByExternalId: jest.fn().mockResolvedValue({ movie_results: [{ id: 22 }], tv_results: [{ id: 22 }] }),
    getIdentityDetails: jest.fn().mockResolvedValue({ id: 22, title: 'Fixture', name: 'Fixture', release_date: '2001-01-01', first_air_date: '2001-01-01' }),
  };
  const upsert = jest.fn();
  try {
    for (let cycle = 0; cycle < 2; cycle++) {
      const store = observationStore(pool); const context = await store.start(serverId, libraryId);
      const plan = createMediaSyncRecoveryWorkflow({ store, context, upsert, logger: { warn: jest.fn() },
        recovery: createMediaSyncIdentityRecovery({ tmdbService }),
        persistRecovery: (currentStore, currentContext, proof) => persistRecoveredSyncItem(currentStore, currentContext, proof, { analyze: async () => ({ analyzed: false }) }),
        source: { libraryKey: 'library-1', service: { getLibraryItemIdentityEvidence: async (_url, _key, _library, id) =>
          id === '0001' ? items[1].source_identity_evidence : { mediaType, snapshotDigest: 'changed-source' } } },
      });
      let completed = 0;
      for (const item of items) { await store.capture(context, [item]); completed += await plan.process(item); }
      completed += await plan.flush();
      expect(completed).toBe(2);
      await store.finish(context);
      // The second scan reads a receipt and cooldown; it makes no new TMDb calls.
      expect(tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(2);
      const row = (await pool.query('SELECT external_id,tmdb_id,metadata FROM media_server_items WHERE library_id=$1', [libraryId])).rows;
      expect(row).toHaveLength(1);
      expect(row[0]).toMatchObject({ external_id: '0001', tmdb_id: 22,
        metadata: { source_identity_recovery: { source_digest: items[1].source_identity_evidence.snapshotDigest } } });
      expect(Number.isFinite(Date.parse(row[0].metadata.source_identity_recovery.persisted_at))).toBe(true);
      expect((await pool.query('SELECT external_id,recovery_outcome FROM media_source_observations WHERE library_id=$1', [libraryId])).rows)
        .toEqual([{ external_id: '0000', recovery_outcome: 'source_changed' }]);
    }
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.every(([item]) => item.external_id === '0000')).toBe(true);
  } finally { await cleanup(pool, serverId); }
});

test('claim-before-provider crash survives an actual isolated PostgreSQL restart and loses priority', async () => {
  // Own this container exclusively; never restart the shared integration server or app container.
  const container = await new PostgreSqlContainer('pgvector/pgvector:0.8.6-pg18')
    .withPassword(randomUUID()).withCommand(['postgres', '-c', 'shared_preload_libraries=pg_stat_statements']).start();
  const connect = () => new pg.Pool({ host: container.getHost(), port: container.getPort(),
    database: container.getDatabase(), user: container.getUsername(), password: container.getPassword() });
  let pool;
  try {
    await container.copyFilesToContainer([{ source: fileURLToPath(new URL('../../../../database/schema/current.sql', import.meta.url)), target: '/tmp/fairness-schema.sql' }]);
    const loaded = await container.exec(['psql', '-v', 'ON_ERROR_STOP=1', '-U', container.getUsername(), '-d', container.getDatabase(), '-f', '/tmp/fairness-schema.sql']);
    expect(loaded.exitCode).toBe(0);
    pool = connect();
    const started = (await pool.query('SELECT pg_postmaster_start_time() started')).rows[0].started;
    const { serverId, libraryId } = await seed(pool);
    let store = observationStore(pool); let context = await store.start(serverId, libraryId);
    const items = Array.from({ length: 9 }, (_, index) => fixture(index));
    await store.capture(context, items);
    expect(await claimSyncIdentityRecovery(store, context, items[0])).toBe(true);
    // Simulate interruption before provider IO or completion; no release/finish.
    await pool.end(); pool = null;
    await container.restart();
    pool = connect();
    expect((await pool.query('SELECT pg_postmaster_start_time() started')).rows[0].started.getTime()).toBeGreaterThan(started.getTime());
    store = observationStore(pool); context = await store.start(serverId, libraryId);
    await store.capture(context, items);
    expect(await readSyncIdentityRecoveryPriority(store, context, items[0])).toBeNull();
    expect(await claimSyncIdentityRecovery(store, context, items[0])).toBe(false);
    await pool.query("UPDATE media_source_observations SET recovery_retry_after=clock_timestamp()-INTERVAL '1 second' WHERE library_id=$1", [libraryId]);
    expect((await readSyncIdentityRecoveryPriority(store, context, items[0])).attemptedAt).toEqual(expect.any(Number));
    const { plan, provider } = workflow(store, context);
    for (const item of items) await plan.process(item);
    await plan.flush();
    expect(provider).toHaveBeenCalledTimes(8);
    const rows = (await pool.query('SELECT external_id,recovery_outcome FROM media_source_observations WHERE library_id=$1 ORDER BY external_id', [libraryId])).rows;
    expect(rows[0].recovery_outcome).toBeNull();
    expect(rows.slice(1).every(row => row.recovery_outcome === 'provider_unavailable')).toBe(true);
  } finally {
    try { await pool?.end(); } finally { await container.stop(); }
  }
});
