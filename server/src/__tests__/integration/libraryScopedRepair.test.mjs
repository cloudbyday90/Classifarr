/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { installScopedRepairPrototype } from '../../scripts/libraryScopedRepair/schema.mjs';
import { seedScopedFixture } from '../../scripts/libraryScopedRepair/fixture.mjs';
import { visitScopedRepair, visitScopedRepairInTransaction } from '../../scripts/libraryScopedRepair/visit.mjs';
import { mutateScopedRepair } from '../../scripts/libraryScopedRepair/mutation.mjs';
import { withScopedRepairLibraries } from '../../scripts/libraryScopedRepair/locking.mjs';
import { pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME as now } from '../../scripts/libraryPageRepair/fixture.mjs';
import { inventoryObservationValidityCases } from '../helpers/inventoryObservationValidityCases.mjs';

let db, installed;
beforeEach(async () => {
    db = await getPool().connect(); installed = false;
    await db.query('BEGIN'); await installScopedRepairPrototype(db, 'disposable');
    await db.query('COMMIT'); installed = true;
});
afterEach(async () => {
    try { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE'); }
    finally { db.release(); }
});
const visit = (libraryId = 1, time = now) => visitScopedRepair(pageRepairClock(db, time), { scope: 'disposable', libraryId });
const write = (libraries, sql, values) => withScopedRepairLibraries(db, 'disposable', libraries, 'write', () => db.query(sql, values));
const mutate = items => mutateScopedRepair(db, 'disposable', items);

test.each([1, 20000, 20001, 40001])('row-count pages complete %i sparse rows within deterministic work bounds', async rows => {
    await seedScopedFixture(db, { rows, stride: 11 });
    for (let index = 0; index < Math.ceil(rows / 20000); index++) {
        const result = await visit();
        expect(result.metadataRowsRead).toBeLessThanOrEqual(20000);
        expect(result.lookaheadRowsRead).toBeLessThanOrEqual(20001);
        expect(result.status).toBe(index === Math.ceil(rows / 20000) - 1 ? 'complete' : 'in_progress');
        if (result.counts) expect(Object.values(result.counts)).toEqual(Array(7).fill(rows));
    }
    expect(await visit()).toMatchObject({ status: 'complete', metadataRowsRead: 0, lookaheadRowsRead: 0 });
});

test('growth splits a full cached page and withholds counts until its tail is measured', async () => {
    await seedScopedFixture(db, { rows: 20000, stride: 2 });
    await visit();
    await mutate([{ kind: 'insert', id: 1, libraryId: 1 }]);
    expect(await visit()).toMatchObject({ status: 'in_progress', counts: null, metadataRowsRead: 20000, cachedPages: 2 });
    expect(await visit()).toMatchObject({ status: 'complete', metadataRowsRead: 1, counts: { inventory: 20001, captured: 20000 } });
});

test('the shared production predicate classifies all 32 validity cases and withholds oversized observations', async () => {
    await mutate(inventoryObservationValidityCases.map(({ record }, i) => ({ kind: 'insert', id: i + 1, libraryId: 1,
        mediaType: 'movie', tmdbId: 7, metadata: { inventory_tmdb: record }, fetchedAt: '2026-08-01T00:00:00Z' })));
    expect(await visit()).toMatchObject({ counts: { inventory: 32, captured: 6, fresh: 6 } });
    await mutate([{ kind: 'insert', id: 33, libraryId: 1, mediaType: 'movie', tmdbId: 7,
        metadata: { inventory_tmdb: { ...inventoryObservationValidityCases[0].record, extra: 'x'.repeat(5000) } } }]);
    expect(await visit()).toMatchObject({ counts: { inventory: 33, captured: 6 } });
});

test('clock-only writes, identity corrections, moves through null and deletes invalidate their actual libraries', async () => {
    await seedScopedFixture(db, { rows: 1 }); await visit(); await visit(2);
    await write([1], "UPDATE scoped_repair_lab.scoped_repair_source SET inventory_tmdb_fetched_at='2026-07-01'");
    expect(await visit()).toMatchObject({ counts: { fresh: 0, captured: 1 } });
    await write([1], 'UPDATE scoped_repair_lab.scoped_repair_source SET tmdb_id=2');
    expect(await visit()).toMatchObject({ counts: { captured: 0 } });
    await mutate([{ kind: 'replace', id: 1, expectedLibraryId: 1, libraryId: null }]);
    expect(await visit()).toMatchObject({ counts: { inventory: 0 }, cachedPages: 0 });
    await mutate([{ kind: 'replace', id: 1, expectedLibraryId: null, libraryId: 2 }]);
    expect(await visit(2)).toMatchObject({ status: 'restart_required', reason: 'unmapped_change', counts: null });
    expect(await visit(2)).toMatchObject({ counts: { inventory: 1 } });
    await mutate([{ kind: 'delete', id: 1, expectedLibraryId: 2 }]);
    expect(await visit(2)).toMatchObject({ counts: { inventory: 0 } });
});

test('undeclared source and destination locks reject source changes atomically', async () => {
    await seedScopedFixture(db, { rows: 1 });
    await expect(db.query('UPDATE scoped_repair_lab.scoped_repair_source SET library_id=2')).rejects.toMatchObject({ code: '55000' });
    await expect(write([1], 'UPDATE scoped_repair_lab.scoped_repair_source SET library_id=2')).rejects.toMatchObject({ code: '55000' });
    await expect(write([2], 'UPDATE scoped_repair_lab.scoped_repair_source SET library_id=2')).rejects.toMatchObject({ code: '55000' });
    expect((await db.query('SELECT library_id FROM scoped_repair_lab.scoped_repair_source')).rows).toEqual([{ library_id: 1 }]);
});

test('stale membership rolls back earlier batch operations and cache invalidations', async () => {
    await seedScopedFixture(db, { rows: 2 }); await visit();
    await expect(mutate([{ kind: 'delete', id: 1, expectedLibraryId: 1 },
        { kind: 'replace', id: 2, expectedLibraryId: 2, libraryId: 1 }])).rejects.toThrow('membership changed');
    expect(await visit()).toMatchObject({ revision: '0', metadataRowsRead: 0, counts: { inventory: 2 } });
});

test('an invalidation gap stays sticky through subsequent writes and starts a new epoch', async () => {
    await seedScopedFixture(db, { rows: 1 }); const initial = await visit();
    await db.query('UPDATE scoped_repair_lab.scoped_repair_heads SET revision=9007199254740993 WHERE library_id=1');
    await write([1], 'UPDATE scoped_repair_lab.scoped_repair_source SET tmdb_id=2');
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'missing_invalidation', counts: null });
    const rebuilt = await visit();
    expect(rebuilt).toMatchObject({ status: 'complete', revision: '9007199254740994' });
    expect(rebuilt.epoch).not.toBe(initial.epoch);
});

test('oversized transition sets and truncate fail closed', async () => {
    await seedScopedFixture(db, { rows: 129 }); await visit();
    await write([1], 'UPDATE scoped_repair_lab.scoped_repair_source SET tmdb_id=NULL');
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'change_batch_overflow', counts: null });
    await visit(); await db.query('TRUNCATE scoped_repair_lab.scoped_repair_source');
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'unsupported_change', counts: null });
    expect(await visit()).toMatchObject({ counts: { inventory: 0 } });
});

test('expiry is automatic, including expiry during measurement and a backward clock', async () => {
    await seedScopedFixture(db, { rows: 1 });
    await write([1], "UPDATE scoped_repair_lab.scoped_repair_source SET inventory_tmdb_fetched_at='2026-07-03'");
    const boundary = Date.parse('2026-08-02T00:00:00Z');
    expect(await visit(1, boundary - 1)).toMatchObject({ counts: { fresh: 1 } });
    let clocks = 0;
    const crossing = { query: (sql, values) => sql === 'SELECT clock_timestamp()::text AS now' ?
        Promise.resolve({ rows: [{ now: new Date(boundary - 1 + clocks++).toISOString() }] }) : db.query(sql, values) };
    expect(await visitScopedRepair(crossing, { scope: 'disposable', libraryId: 1 })).toMatchObject({ status: 'in_progress', counts: null });
    expect(await visit()).toMatchObject({ metadataRowsRead: 1, counts: { fresh: 0 } });
    expect(await visit(1, boundary - 1)).toMatchObject({ status: 'restart_required', reason: 'clock_regression', counts: null });
});

test('oldest dirty ranges progress despite repeated changes in the first range', async () => {
    await seedScopedFixture(db, { rows: 40001 }); await visit(); await visit(); await visit();
    await write([1], 'UPDATE scoped_repair_lab.scoped_repair_source SET tmdb_id=NULL WHERE id IN (1,20001,40001)');
    expect((await visit()).metadataRowsRead).toBe(20000);
    await write([1], 'UPDATE scoped_repair_lab.scoped_repair_source SET tmdb_id=1 WHERE id=1');
    expect((await visit()).metadataRowsRead).toBe(20000);
    await write([1], 'UPDATE scoped_repair_lab.scoped_repair_source SET tmdb_id=NULL WHERE id=1');
    expect((await visit()).metadataRowsRead).toBe(1);
    expect(await visit()).toMatchObject({ status: 'complete', counts: { captured: 39998 } });
});

test('reclaimed empty summaries detect reinsertion, and selected state age resets explicitly', async () => {
    await seedScopedFixture(db, { rows: 1 }); await visit();
    await mutate([{ kind: 'delete', id: 1, expectedLibraryId: 1 }]);
    expect(await visit()).toMatchObject({ cachedPages: 0, counts: { inventory: 0 } });
    await mutate([{ kind: 'insert', id: 2, libraryId: 1 }]);
    expect(await visit()).toMatchObject({ reason: 'unmapped_change', counts: null });
    await visit();
    expect(await visit(1, now + 7 * 86400000 + 1)).toMatchObject({ reason: 'state_expired', counts: null });
});

test('temporary installation, writes and reports disappear on rollback', async () => {
    await db.query('BEGIN'); await installScopedRepairPrototype(db, 'temporary');
    expect(await visitScopedRepairInTransaction(pageRepairClock(db, now), { scope: 'temporary', libraryId: 1 })).toMatchObject({ counts: { inventory: 0 } });
    await db.query('ROLLBACK');
    expect((await db.query("SELECT to_regclass('pg_temp.scoped_repair_source') IS NULL clean")).rows[0].clean).toBe(true);
});

test('moving a source ID between cached pages invalidates both ranges', async () => {
    await seedScopedFixture(db, { rows: 20001 }); await visit(); await visit();
    await write([1], 'UPDATE scoped_repair_lab.scoped_repair_source SET id=50000 WHERE id=1');
    expect(await visit()).toMatchObject({ status: 'in_progress', counts: null, metadataRowsRead: 19999 });
    expect(await visit()).toMatchObject({ status: 'complete', metadataRowsRead: 2, counts: { inventory: 20001, captured: 20001 } });
});

test('an exhausted global summary pool prevents a repair split without evicting another library', async () => {
    await seedScopedFixture(db, { rows: 20000, stride: 2 }); await visit(); await visit(2);
    // Reserve all remaining capacity using dirty placeholders; no fabricated complete counts.
    await db.query(`UPDATE scoped_repair_lab.scoped_repair_pages SET owner=(SELECT slot FROM scoped_repair_lab.scoped_repair_heads WHERE library_id=2),
        low_id=slot*20000,high_id=(slot+1)*20000,dirty_since=0 WHERE owner IS NULL`);
    await mutate([{ kind: 'insert', id: 1, libraryId: 1 }]);
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'page_capacity_busy_or_full', counts: null, metadataRowsRead: 0 });
    expect((await db.query(`SELECT count(*)::integer n FROM scoped_repair_lab.scoped_repair_pages
        WHERE owner=(SELECT slot FROM scoped_repair_lab.scoped_repair_heads WHERE library_id=2)`)).rows[0].n).toBe(127);
    await expect(db.query('INSERT INTO scoped_repair_lab.scoped_repair_pages(slot) VALUES(128)')).rejects.toMatchObject({ code: '23514' });
});
