/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { installPageRepairPrototype } from '../../scripts/libraryPageRepair/schema.mjs';
import { pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME as now } from '../../scripts/libraryPageRepair/fixture.mjs';
import { visitPageRepair } from '../../scripts/libraryPageRepair/visit.mjs';
import { readRepairOccupancy } from '../../scripts/libraryRepairAssessment/occupancy.mjs';

let db, installed;
beforeEach(async () => {
    db = await getPool().connect(); installed = false;
    await db.query('BEGIN'); await installPageRepairPrototype(db, 'disposable');
    await db.query('COMMIT'); installed = true;
});
afterEach(async () => {
    try { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA page_repair_lab CASCADE'); }
    finally { db.release(); }
});
const visit = (libraryId = 1, time = now) => visitPageRepair(pageRepairClock(db, time), { scope: 'disposable', libraryId });

test('automatically reclaims idle cursors and their pages while preserving recently visited libraries', async () => {
    await db.query(`INSERT INTO page_repair_lab.page_repair_source(id,library_id)
        SELECT n,n FROM generate_series(1,33) n`);
    for (let id = 1; id <= 32; id++) await visit(id);
    await visit(32, now + 6 * 86400000);
    expect(await visit(33, now + 8 * 86400000)).toMatchObject({ status: 'complete', counts: { inventory: 1 } });
    const states = (await db.query('SELECT library_id FROM page_repair_lab.page_repair_state ORDER BY library_id')).rows;
    expect(states).toEqual([{ library_id: 32 }, { library_id: 33 }]);
    expect((await db.query('SELECT count(*)::integer n FROM page_repair_lab.page_repair_pages')).rows[0].n).toBe(2);
});

test('releases empty range summaries and still detects a later insert behind the cursor', async () => {
    await db.query('INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(1,1),(40001,1)');
    await visit(); await visit();
    await db.query('DELETE FROM page_repair_lab.page_repair_source WHERE id=1');
    expect((await visit()).counts.inventory).toBe(1);
    expect((await db.query('SELECT count(*)::integer n FROM page_repair_lab.page_repair_pages')).rows[0].n).toBe(1);
    await db.query('INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(2,1)');
    expect(await visit()).toMatchObject({ status: 'complete', counts: { inventory: 2 } });
});

test('a reader waiting behind truncate does not hold the publication head', async () => {
    await db.query('INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(1,1)');
    await visit();
    const writer = await getPool().connect();
    let pending;
    try {
        await writer.query("BEGIN; SET LOCAL statement_timeout='5s'; LOCK TABLE page_repair_lab.page_repair_source IN ACCESS EXCLUSIVE MODE");
        const pid = (await db.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        pending = visit().then(value => ({ value }), error => ({ error }));
        let blocked = false;
        for (let attempt = 0; attempt < 40 && !blocked; attempt++) {
            blocked = (await getPool().query('SELECT cardinality(pg_blocking_pids($1))>0 blocked', [pid])).rows[0].blocked;
            if (!blocked) await new Promise(resolve => { setTimeout(resolve, 20); });
        }
        expect(blocked).toBe(true);
        // The old head-first reader fails here, before a table/head cycle can persist.
        await writer.query('SELECT * FROM page_repair_lab.page_repair_head FOR UPDATE NOWAIT');
        await writer.query('TRUNCATE page_repair_lab.page_repair_source; COMMIT');
        expect((await pending).value).toMatchObject({ status: 'restart_required', reason: 'unsupported_change', counts: null });
    } finally {
        await writer.query('ROLLBACK');
        if (pending) await pending;
        writer.release();
    }
});

test('idle expiry respects the exact boundary and preserves selected-library restart diagnostics', async () => {
    await visit(1); await visit(2);
    await visit(3, now + 7 * 86400000);
    expect((await db.query('SELECT count(*)::integer n FROM page_repair_lab.page_repair_state')).rows[0].n).toBe(3);
    expect(await visit(1, now + 7 * 86400000 + 1)).toMatchObject({ status: 'restart_required', reason: 'state_expired', counts: null });
    expect((await db.query('SELECT library_id FROM page_repair_lab.page_repair_state ORDER BY library_id')).rows).toEqual([{ library_id: 3 }]);
});

test('reclamation rolls back if admitting the replacement cursor fails', async () => {
    await visit(1);
    const faulty = { query: (sql, values) => sql.startsWith('INSERT INTO page_repair_lab.page_repair_state') ?
        db.query('SELECT 1/0') : pageRepairClock(db, now + 8 * 86400000).query(sql, values) };
    await expect(visitPageRepair(faulty, { scope: 'disposable', libraryId: 2 })).rejects.toMatchObject({ code: '22012' });
    expect((await db.query('SELECT library_id FROM page_repair_lab.page_repair_state')).rows).toEqual([{ library_id: 1 }]);
});

test('an empty reclaimed range cannot hide an insert when its journal event is missing', async () => {
    await db.query('INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(1,1)');
    await visit();
    await db.query('DELETE FROM page_repair_lab.page_repair_source');
    expect((await visit()).counts.inventory).toBe(0);
    await db.query(`INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(2,1);
        DELETE FROM page_repair_lab.page_repair_journal WHERE sequence=(SELECT sequence FROM page_repair_lab.page_repair_head)`);
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'missing_continuity', counts: null });
});

test('occupancy measures sparse and empty active libraries in a database-enforced read-only snapshot', async () => {
    await db.query(`CREATE TABLE page_repair_lab.page_repair_catalog(id integer PRIMARY KEY,is_active boolean);
        INSERT INTO page_repair_lab.page_repair_catalog VALUES(1,true),(2,true),(3,false);
        INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(1,1),(40001,1),(2,3)`);
    const result = await readRepairOccupancy(db, 'prototype');
    expect(result).toMatchObject({ complete: true, observedItems: 2, observedRanges: 2, fitsGlobalCapacity: true });
    const attemptingWrite = { query: (sql, values) => sql.includes('WHERE is_active') ?
        db.query('DELETE FROM page_repair_lab.page_repair_source') : db.query(sql, values) };
    await expect(readRepairOccupancy(attemptingWrite, 'prototype')).rejects.toMatchObject({ code: '25006' });
    expect((await db.query('SELECT count(*)::integer n FROM page_repair_lab.page_repair_source')).rows[0].n).toBe(3);
});
