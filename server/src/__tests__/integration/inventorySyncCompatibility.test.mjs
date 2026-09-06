/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { installSyncCompatibilityPrototype } from '../../scripts/inventoryWriterCompatibility/syncSchema.mjs';
import { createScopedSyncAdapter } from '../../scripts/inventoryWriterCompatibility/syncAdapter.mjs';
import { persistSyncedMediaItem } from '../../services/mediaSyncItemPersistence.mjs';
import { createTmdbIdentityOrigin } from '../../services/mediaSourceIdentity.mjs';
import { READ_SYNC_ITEM, UPSERT_SYNC_ITEM } from '../../services/mediaSyncItemQueries.mjs';
import { withScopedRepairLibraries } from '../../scripts/libraryScopedRepair/locking.mjs';
import { visitScopedRepair } from '../../scripts/libraryScopedRepair/visit.mjs';
import { measureSyncInsertRace } from '../../scripts/inventoryWriterCompatibility/syncAssessment.mjs';
import { readWriterDatabaseContract } from '../../scripts/inventoryWriterCompatibility/databaseContract.mjs';
import { scopedSyncQueries } from '../../scripts/inventoryWriterCompatibility/syncQueries.mjs';

let db, installed, query, analyze;
const item = () => ({ external_id: 'fixture-key', title: 'Stable source', year: 2001, media_type: 'movie',
    imdb_id: 'tt123', content_rating: 'TV-14', genres: ['Drama'], metadata: { summary: 'Fixture' } });
beforeEach(async () => {
    db = await getPool().connect(); installed = false;
    await db.query('BEGIN'); await installSyncCompatibilityPrototype(db); await db.query('COMMIT'); installed = true;
    await db.query('INSERT INTO scoped_repair_lab.sync_servers VALUES(1),(2); INSERT INTO scoped_repair_lab.sync_libraries VALUES(1),(2),(3)');
    query = createScopedSyncAdapter(db); analyze = jest.fn().mockResolvedValue({ analyzed: false });
});
afterEach(async () => {
    try { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE'); }
    finally { db.release(); }
});
const sync = (incoming = item(), library = 1, adapter = query) => persistSyncedMediaItem(1, library, incoming, { query: adapter, analyze });
const stored = async () => (await db.query('SELECT *,xmin::text revision FROM scoped_repair_lab.scoped_repair_source ORDER BY id')).rows[0];
const write = (libraries, sql, values) => withScopedRepairLibraries(db, 'disposable', libraries, 'write', () => db.query(sql, values));
const visit = libraryId => visitScopedRepair(db, { scope: 'disposable', libraryId });
async function enrich() {
    const row = await stored(), origin = createTmdbIdentityOrigin(row, 42, 'queue_resolution');
    await write([row.library_id], `UPDATE scoped_repair_lab.scoped_repair_source SET tmdb_id=42,
        metadata=metadata || $1::jsonb,inventory_tmdb_attempted_at=NOW(),inventory_tmdb_fetched_at=NOW(),
        original_rating=content_rating,content_rating='PG-13'`, [JSON.stringify({ tmdb_identity_origin: origin,
        inventory_tmdb: { version: 1, tmdb_id: 42, media_type: row.media_type, keywords: ['space'], original_language: 'ja' } })]);
    return stored();
}

test.each(['movie', 'tv'])('retains resolved %s identity, observation clocks and rating across omissions and a library move', async type => {
    const incoming = { ...item(), media_type: type };
    expect(await sync(incoming)).toBe('synced'); const before = await enrich(); await visit(1); await visit(2);
    expect(await sync(incoming, 2)).toBe('synced');
    const after = await stored();
    expect(after).toMatchObject({ library_id: 2, tmdb_id: 42, content_rating: 'PG-13', original_rating: 'TV-14',
        metadata: { inventory_tmdb: before.metadata.inventory_tmdb, tmdb_identity_origin: before.metadata.tmdb_identity_origin } });
    expect(after.inventory_tmdb_fetched_at).toEqual(before.inventory_tmdb_fetched_at);
    expect(after.inventory_tmdb_attempted_at).toEqual(before.inventory_tmdb_attempted_at);
    expect(await visit(1)).toMatchObject({ counts: { inventory: 0 } });
    expect(await visit(2)).toMatchObject({ reason: 'unmapped_change', counts: null });
    expect(await visit(2)).toMatchObject({ counts: { inventory: 1, captured: 1 } });
});

test.each([{ title: 'Reused key' }, { year: 2002 }, { imdb_id: 'tt999' }, { media_type: 'tv' }, { tmdb_id: 99 }])(
    'clears incompatible enrichment and clocks after source changes: %j', async patch => {
        await sync(); await enrich(); expect(await sync({ ...item(), ...patch })).toBe('synced');
        expect(await stored()).toMatchObject({ tmdb_id: patch.tmdb_id ?? null, content_rating: 'TV-14', original_rating: null,
            metadata: item().metadata, inventory_tmdb_attempted_at: null, inventory_tmdb_fetched_at: null });
    });

test.each(['move', 'delete', 'enrich'])('retries an intervening %s and recomputes the current source decision', async action => {
    await sync(); let raced = false, reads = 0;
    const adapter = async (operation, values) => {
        if (operation === READ_SYNC_ITEM) reads++;
        if (operation === UPSERT_SYNC_ITEM && !raced) {
            raced = true;
            if (action === 'move') await write([1, 3], 'UPDATE scoped_repair_lab.scoped_repair_source SET library_id=3');
            else if (action === 'delete') await write([1], 'DELETE FROM scoped_repair_lab.scoped_repair_source');
            else await enrich();
        }
        return query(operation, values);
    };
    analyze.mockClear();
    expect(await sync(item(), 2, adapter)).toBe('synced');
    expect(reads).toBe(2); expect(analyze).toHaveBeenCalledTimes(1);
    expect(await stored()).toMatchObject({ library_id: 2, tmdb_id: action === 'enrich' ? 42 : null });
});

test('three stale attempts return contention without an unconditional overwrite', async () => {
    await sync(); let attempts = 0;
    const adapter = async (operation, values) => {
        if (operation === UPSERT_SYNC_ITEM) { attempts++; await write([1], 'UPDATE scoped_repair_lab.scoped_repair_source SET year=year+1'); }
        return query(operation, values);
    };
    expect(await sync(item(), 2, adapter)).toBe('concurrent_source_change');
    expect(attempts).toBe(3); expect(await stored()).toMatchObject({ library_id: 1, year: 2004 });
});

test('analysis happens while the dedicated database session is idle', async () => {
    const pid = (await db.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    analyze.mockImplementation(async () => {
        const row = (await getPool().query('SELECT state,xact_start FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
        expect(row).toEqual({ state: 'idle', xact_start: null }); return { analyzed: false };
    });
    expect(await sync()).toBe('synced');
});

test.each(['sync_libraries', 'sync_servers'])('an undeclared %s cascade rejects the parent deletion and preserves inventory', async parent => {
    await sync(); await visit(1);
    // Both identifiers are fixed fixture table names, never external input.
    await expect(db.query(`DELETE FROM scoped_repair_lab.${parent} WHERE id=1`)).rejects.toMatchObject({ code: '55000' });
    expect(await stored()).toMatchObject({ library_id: 1 });
    expect(await visit(1)).toMatchObject({ metadataRowsRead: 0, counts: { inventory: 1 } });
});

test('database errors roll back mutations and release advisory locks for the next sync', async () => {
    await expect(sync(item(), 99)).rejects.toMatchObject({ code: '23503' });
    expect(await stored()).toBeUndefined();
    expect((await db.query("SELECT count(*)::integer n FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'")).rows[0].n).toBe(0);
    expect(await sync()).toBe('synced');
});

test('same-key inserts serialize before library discovery, automatically retry, and allow unrelated progress', async () => {
    const first = await getPool().connect(), second = await getPool().connect();
    try {
        expect(await measureSyncInsertRace(db, first, second)).toMatchObject({ sameKeyIdentityWaitObserved: true,
            staleInsertRetried: true, singleStoredIdentity: true, unrelatedCommittedWhileHeld: true });
    } finally { first.release(); second.release(); }
});

test('catalog assessment reads the real migrated schema in a database-enforced read-only transaction', async () => {
    const result = await readWriterDatabaseContract(db);
    expect(result).toMatchObject({ sourceFound: true, itemRowsRead: 0, writes: 0, productionCompatible: false });
    expect(result.observationClockColumns).toHaveLength(2);
    expect(result.foreignKeys).toEqual(expect.arrayContaining([expect.objectContaining({ parent_table: 'libraries', delete_action: 'c' })]));
    const faulty = { query: (sql, values) => sql.startsWith('SELECT c.oid') ? db.query('DELETE FROM public.media_server_items') : db.query(sql, values) };
    await expect(readWriterDatabaseContract(faulty)).rejects.toMatchObject({ code: '25006' });
});

test('a move between membership discovery and library locking retries before touching an undeclared library', async () => {
    await sync();
    const peer = await getPool().connect(), sql = scopedSyncQueries(); let raced = false, writes = 0;
    const guarded = { query: async (statement, values) => {
        const result = await db.query(statement, values);
        if (statement === sql.upsert) writes++;
        if (statement === sql.membership && !raced) {
            raced = true;
            await withScopedRepairLibraries(peer, 'disposable', [1, 3], 'write', () =>
                peer.query('UPDATE scoped_repair_lab.scoped_repair_source SET library_id=3'));
        }
        return result;
    } };
    try {
        expect(await sync(item(), 2, createScopedSyncAdapter(guarded))).toBe('synced');
        expect(writes).toBe(1); expect(await stored()).toMatchObject({ library_id: 2 });
    } finally { peer.release(); }
});
