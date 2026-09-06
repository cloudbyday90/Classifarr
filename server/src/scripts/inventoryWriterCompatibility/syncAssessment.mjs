/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { persistSyncedMediaItem } from '../../services/mediaSyncItemPersistence.mjs';
import { READ_SYNC_ITEM } from '../../services/mediaSyncItemQueries.mjs';
import { createTmdbIdentityOrigin } from '../../services/mediaSourceIdentity.mjs';
import { installSyncCompatibilityPrototype } from './syncSchema.mjs';
import { createScopedSyncAdapter, SYNC_IDENTITY_LOCK_NAMESPACE } from './syncAdapter.mjs';
import { scopedSyncQueries } from './syncQueries.mjs';
import { waitForRepairBlocking } from '../libraryRepairAssessment/concurrency.mjs';
import { withScopedRepairLibraries } from '../libraryScopedRepair/locking.mjs';

const incoming = () => ({ external_id: 'shared-key', title: 'Stable source', year: 2001, media_type: 'movie',
    imdb_id: 'tt123', content_rating: 'TV-14', genres: ['Drama'], metadata: {} });
const analyze = async () => ({ analyzed: false });
const persist = (query, library, item = incoming()) => persistSyncedMediaItem(1, library, item, { query, analyze });

export async function measureSyncInsertRace(observer, first, second) {
    let release, signal, left, right, reads = 0;
    const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { signal = resolve; });
    const sql = scopedSyncQueries();
    const paused = { query: async (statement, values) => {
        if (statement === sql.upsert) { signal(true); await gate; }
        return first.query(statement, values);
    } };
    const secondAdapter = createScopedSyncAdapter(second);
    try {
        left = persist(createScopedSyncAdapter(paused), 1).then(value => ({ value }), error => { signal(false); return { error }; });
        if (!await ready) throw new Error('Sync insertion fixture failed before its lock checkpoint');
        const pid = (await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        right = persist((operation, values) => { if (operation === READ_SYNC_ITEM) reads++; return secondAdapter(operation, values); }, 2)
            .then(value => ({ value }), error => ({ error }));
        await waitForRepairBlocking(observer, pid);
        const identityWait = (await observer.query(`SELECT count(*)::integer n FROM pg_locks
            WHERE pid=$1 AND locktype='advisory' AND NOT granted AND classid=$2::oid`, [pid, SYNC_IDENTITY_LOCK_NAMESPACE])).rows[0].n;
        if (identityWait !== 1) throw new Error('Same-key writer did not wait on identity ordering');
        const before = performance.now();
        if (await persist(createScopedSyncAdapter(observer), 3, { ...incoming(), external_id: 'other-key' }) !== 'synced') throw new Error('Unrelated sync failed');
        const unrelatedWriteMs = Number((performance.now() - before).toFixed(2));
        release();
        if ((await left).value !== 'synced' || (await right).value !== 'synced' || reads !== 2) throw new Error('Sync insertion retry contract failed');
        const rows = (await observer.query("SELECT library_id FROM scoped_repair_lab.scoped_repair_source WHERE external_id='shared-key'")).rows;
        if (rows.length !== 1 || rows[0].library_id !== 2) throw new Error('Sync insertion membership oracle mismatch');
        return { sameKeyIdentityWaitObserved: true, staleInsertRetried: true, readsOnRetriedSync: reads,
            singleStoredIdentity: true, unrelatedCommittedWhileHeld: true, unrelatedWriteMs };
    } finally {
        release(); if (left) await left; if (right) await right;
        await first.query('ROLLBACK'); await second.query('ROLLBACK');
    }
}

async function measureRetention(db) {
    const before = (await db.query("SELECT * FROM scoped_repair_lab.scoped_repair_source WHERE external_id='shared-key'")).rows[0];
    const origin = createTmdbIdentityOrigin(before, 42, 'queue_resolution');
    await withScopedRepairLibraries(db, 'disposable', [2], 'write', () => db.query(`UPDATE scoped_repair_lab.scoped_repair_source
        SET tmdb_id=42,metadata=$1,original_rating='TV-14',content_rating='PG-13',
        inventory_tmdb_attempted_at='2026-08-01',inventory_tmdb_fetched_at='2026-08-01' WHERE external_id='shared-key'`,
    [JSON.stringify({ tmdb_identity_origin: origin, inventory_tmdb: { version: 1, tmdb_id: 42, media_type: 'movie', keywords: ['space'], original_language: 'ja' } })]));
    const query = createScopedSyncAdapter(db);
    if (await persist(query, 1) !== 'synced') throw new Error('Retention fixture move failed');
    const retained = (await db.query("SELECT * FROM scoped_repair_lab.scoped_repair_source WHERE external_id='shared-key'")).rows[0];
    if (retained.tmdb_id !== 42 || retained.content_rating !== 'PG-13' || !retained.inventory_tmdb_fetched_at || !retained.metadata.inventory_tmdb) throw new Error('Sync retention oracle mismatch');
    if (await persist(query, 1, { ...incoming(), title: 'Reused identity' }) !== 'synced') throw new Error('Changed-source fixture failed');
    const changed = (await db.query("SELECT * FROM scoped_repair_lab.scoped_repair_source WHERE external_id='shared-key'")).rows[0];
    if (changed.tmdb_id !== null || changed.inventory_tmdb_fetched_at !== null || changed.metadata.inventory_tmdb || changed.original_rating !== null) throw new Error('Changed-source reset oracle mismatch');
    let rejected = false;
    try { await db.query('DELETE FROM scoped_repair_lab.sync_libraries WHERE id=1'); }
    catch (error) { if (error.code !== '55000') throw error; rejected = true; }
    if (!rejected) throw new Error('Undeclared parent cascade was not rejected');
    return { resolvedIdentityAndObservationsRetainedOnMove: true, incompatibleSourceCleared: true, undeclaredCascadeRejected: true };
}

export async function runSyncCompatibilityMeasurements(db, { withClient }) {
    let installed = false, report;
    await db.query('BEGIN');
    try {
        await installSyncCompatibilityPrototype(db); await db.query('COMMIT'); installed = true;
        await db.query('INSERT INTO scoped_repair_lab.sync_servers VALUES(1); INSERT INTO scoped_repair_lab.sync_libraries VALUES(1),(2),(3)');
        const concurrency = await withClient(first => withClient(second => measureSyncInsertRace(db, first, second)));
        report = { contract: 'inventory.sync-compatibility.benchmark.v1', concurrency, retention: await measureRetention(db),
            productionPromotion: false, providerRequests: 0, productionWrites: 0 };
    } finally { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE'); }
    if (!(await db.query("SELECT to_regnamespace('scoped_repair_lab') IS NULL clean")).rows[0].clean) throw new Error('Sync compatibility cleanup failed');
    return { ...report, cleanupVerified: true };
}
