/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { installCorpusProfileFixture, removeCorpusProfileFixture, requireProfileDatabase } from './fixture.mjs';
import { measureCorpusRead, beginCorpusRead, corpusQuerySha256 } from './measurement.mjs';
import { observeCorpusWork, memorySnapshot } from './observation.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_CORPUS_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../../services/sourceConflictAuthorityGuard.mjs';

export async function verifyCorpusLockControl(db, peer, observer, pid) {
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL transaction_timeout='30s'");
    await db.query('LOCK TABLE description_corpus_profile.media_server_items IN ACCESS EXCLUSIVE MODE');
    await beginCorpusRead(peer);
    const observed = await observeCorpusWork(observer, [pid], async () => {
      try {
        await peer.query(INVENTORY_DESCRIPTION_REFRESH_CORPUS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
        return null;
      } catch (error) { return error?.code === '55P03' ? '55P03' : 'unexpected'; }
      finally { await peer.query('ROLLBACK'); }
    });
    if (observed.result !== '55P03' || !(observed.waits.categories.Lock > 0)) {
      throw new Error('corpus_profile_lock_control_failed');
    }
    return { code: observed.result, waits: observed.waits };
  } finally { await db.query('ROLLBACK'); }
}

export async function runCorpusProfileMeasurements(db, { withClient, size = 6500 } = {}) {
  if (typeof withClient !== 'function' || !Number.isInteger(size) || size < 100 || size > 6500) {
    throw new Error('corpus_profile_options_invalid');
  }
  await requireProfileDatabase(db);
  return withClient(peer => withClient(async observer => {
    await requireProfileDatabase(peer);
    await requireProfileDatabase(observer);
    await observer.query("SET statement_timeout='1s'");
    const pids = await Promise.all([db, peer].map(async connection => (await connection.query('SELECT pg_backend_pid() AS pid')).rows[0].pid));
    const settings = (await db.query(`SELECT name,setting,unit FROM pg_settings WHERE name IN
      ('jit','work_mem','shared_buffers','max_parallel_workers_per_gather','track_io_timing') ORDER BY name`)).rows;
    const scenarios = [];
    let fingerprint;
    for (const fallback of ['sparse', 'all']) {
      const fixture = await installCorpusProfileFixture(db, size, fallback);
      try {
        const warmup = await measureCorpusRead(db, fixture.expectedRows);
        fingerprint ??= warmup.fingerprint;
        if (warmup.fingerprint !== fingerprint) throw new Error('corpus_profile_fingerprint_mismatch');
        const cycles = [];
        // Alternate order to reduce fixed warm-up/order bias. Exactly six measured cycles.
        for (const concurrency of [1, 2, 2, 1, 1, 2]) {
          const before = memorySnapshot();
          const observed = await observeCorpusWork(observer, pids.slice(0, concurrency), async () => {
            const results = await Promise.allSettled([db, peer].slice(0, concurrency)
              .map(connection => measureCorpusRead(connection, fixture.expectedRows)));
            if (results.some(result => result.status === 'rejected')) throw new Error('corpus_profile_read_failed');
            return results.map(result => result.value);
          });
          if (observed.result.some(result => result.fingerprint !== fingerprint)) throw new Error('corpus_profile_fingerprint_mismatch');
          cycles.push({ concurrency, before, ...observed, afterReferencesReleased: memorySnapshot() });
        }
        const plans = [];
        for (const mode of ['plan', 'serialize']) plans.push(await measureCorpusRead(db, fixture.expectedRows, mode));
        const lockControl = await verifyCorpusLockControl(db, peer, observer, pids[1]);
        const afterLock = await measureCorpusRead(db, fixture.expectedRows);
        if (afterLock.fingerprint !== fingerprint) throw new Error('corpus_profile_post_lock_mismatch');
        scenarios.push({ fixture, warmup, cycles, plans, lockControl, afterLock });
      } finally { await removeCorpusProfileFixture(db); }
    }
    return { version: 1, kind: 'synthetic_description_corpus_profile', querySha256: corpusQuerySha256,
      settings, scenarios, schemaCleanupVerified: true, providerRequests: 0, productionChanges: 0,
      limits: { databaseMemoryBytes: 1024 ** 3, databaseCpus: 2, pids: 256, clients: 3,
        statementTimeoutMs: 15000, lockTimeoutMs: 2000, repetitionsPerConcurrency: 3 },
      limitations: ['synthetic_warmed_data', 'partial_index_set', 'no_foreign_keys_or_triggers',
        'no_season_mapping_expansion', 'no_application_workers_caches_or_pool', 'host_node_memory_not_container_memory',
        'memory_snapshots_not_retained_heap_or_peak', 'wait_samples_not_durations', 'not_a_historic_incident_replay'] };
  }));
}
