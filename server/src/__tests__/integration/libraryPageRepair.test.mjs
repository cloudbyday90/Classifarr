/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { installPageRepairPrototype } from '../../scripts/libraryPageRepair/schema.mjs';
import { seedPageRepairFixture, pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME as now } from '../../scripts/libraryPageRepair/fixture.mjs';
import { visitPageRepair, visitPageRepairInTransaction } from '../../scripts/libraryPageRepair/visit.mjs';
import { pageRepairSourceSql } from '../../scripts/libraryPageRepair/projection.mjs';

let db, installed;
beforeEach(async () => {
    db = await getPool().connect(); installed = false;
    await db.query('BEGIN');
    await installPageRepairPrototype(db, 'disposable');
    await db.query('COMMIT'); installed = true;
});
afterEach(async () => {
    try { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA page_repair_lab CASCADE'); }
    finally { db.release(); }
});
const visit = (libraryId = 1, time = now) => visitPageRepair(pageRepairClock(db, time), { scope: 'disposable', libraryId });
const seed = rows => seedPageRepairFixture(db, 'disposable', rows);
const counts = async () => (await db.query(`SELECT (SELECT count(*)::integer FROM page_repair_lab.page_repair_pages) pages,
    (SELECT count(*)::integer FROM page_repair_lab.page_repair_journal) events,
    (SELECT count(*)::integer FROM page_repair_lab.page_repair_state) libraries`)).rows[0];

test('repairs a continuously changing earlier page without repeating unaffected pages', async () => {
    await seed(40001);
    expect(await visit()).toMatchObject({ status: 'in_progress', metadataRowsRead: 20000, counts: null });
    await db.query("UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id=1");
    expect(await visit()).toMatchObject({ status: 'in_progress', metadataRowsRead: 20000, counts: null });
    await db.query('UPDATE page_repair_lab.page_repair_source SET inventory_tmdb_attempted_at=NULL WHERE id=1');
    expect(await visit()).toMatchObject({ status: 'in_progress', metadataRowsRead: 1, counts: null });
    await db.query('UPDATE page_repair_lab.page_repair_source SET inventory_tmdb_fetched_at=NULL WHERE id=1');
    const result = await visit();
    expect(result).toMatchObject({ status: 'complete', metadataRowsRead: 20000, counts: { inventory: 40001, captured: 40000, fresh: 40000 } });
    expect(JSON.stringify(result)).not.toMatch(/space|digest|tmdb_id|metadata"/);
});

test('records observation, clock, identity, delete and reassignment changes including both library sides', async () => {
    await seed(3); await visit(); await visit(2);
    await db.query("UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id=1");
    expect((await visit()).counts).toMatchObject({ inventory: 3, captured: 2, fresh: 2 });
    await db.query("UPDATE page_repair_lab.page_repair_source SET inventory_tmdb_fetched_at='2026-08-03' WHERE id=2");
    expect((await visit()).counts).toMatchObject({ captured: 2, fresh: 1 });
    await db.query('UPDATE page_repair_lab.page_repair_source SET tmdb_id=999 WHERE id=3');
    expect((await visit()).counts).toMatchObject({ captured: 1, fresh: 0 });
    await db.query('DELETE FROM page_repair_lab.page_repair_source WHERE id=1');
    expect((await visit()).counts.inventory).toBe(2);
    await db.query('UPDATE page_repair_lab.page_repair_source SET library_id=2,id=20001 WHERE id=2');
    expect((await visit()).counts).toMatchObject({ inventory: 1, captured: 0 });
    expect((await visit(2)).counts).toMatchObject({ inventory: 1, captured: 1 });
    await db.query('UPDATE page_repair_lab.page_repair_source SET library_id=NULL WHERE id=20001');
    expect((await visit(2)).counts.inventory).toBe(0);
});

test('finds sparse ranges, inserts behind the cursor and the maximum integer ID', async () => {
    await db.query(`INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(40001,1),(2147483647,1)`);
    expect(await visit()).toMatchObject({ status: 'in_progress', metadataRowsRead: 1 });
    await db.query('INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(1,1)');
    expect(await visit()).toMatchObject({ status: 'in_progress', metadataRowsRead: 1 });
    expect(await visit()).toMatchObject({ status: 'complete', metadataRowsRead: 1, counts: { inventory: 3 } });
});

test('numeric journal ordering remains contiguous through double digits and above safe JS integers', async () => {
    await seed(1);
    await db.query("UPDATE page_repair_lab.page_repair_head SET sequence=9007199254740992");
    await visit();
    await db.query(`DO $body$ BEGIN FOR n IN 1..15 LOOP
        UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id=1;
        END LOOP; END $body$`);
    expect(await visit()).toMatchObject({ status: 'complete', sequence: '9007199254741007', counts: { captured: 0 } });
});

test('bounded ring overflow and a missing retained event withhold counts and reset state', async () => {
    await seed(1); await visit();
    await db.query(`DO $body$ BEGIN FOR n IN 1..257 LOOP
        UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id=1;
        END LOOP; END $body$`);
    expect((await counts()).events).toBe(256);
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'journal_overflow', counts: null });
    expect((await counts()).pages).toBe(0);
    await visit();
    await db.query(`UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id=1;
        DELETE FROM page_repair_lab.page_repair_journal WHERE sequence=(SELECT sequence FROM page_repair_lab.page_repair_head)`);
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'missing_continuity', counts: null });
});

test('bulk changes over the journal cap and truncate invalidate the entire generation', async () => {
    await seed(1); await visit();
    await db.query(`INSERT INTO page_repair_lab.page_repair_source(id,library_id)
        SELECT n*20000+1,2 FROM generate_series(1,257) n`);
    expect((await counts()).events).toBe(0);
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'journal_overflow', counts: null });
    await visit();
    await db.query('TRUNCATE page_repair_lab.page_repair_source');
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'unsupported_change', counts: null });
    expect((await visit()).counts.inventory).toBe(0);
});

test('expiry repairs old pages even when there are no source changes', async () => {
    await seed(20001);
    await visit(1, Date.parse('2026-08-30T00:00:00Z'));
    const head = (await db.query('SELECT sequence::text FROM page_repair_lab.page_repair_head')).rows[0];
    expect(await visit(1, Date.parse('2026-08-31T00:00:00Z'))).toMatchObject({ status: 'in_progress', counts: null });
    expect(await visit(1, Date.parse('2026-08-31T00:00:00Z'))).toMatchObject({ status: 'complete', sequence: head.sequence,
        counts: { inventory: 20001, captured: 20001, fresh: 0 } });
});

test('expiry during a visit and clock regression never publish stale complete counts', async () => {
    await seed(1);
    let reads = 0;
    const clock = { query: (sql, values) => sql === 'SELECT clock_timestamp()::text AS now' ?
        Promise.resolve({ rows: [{ now: ++reads === 1 ? '2026-08-30T23:59:59Z' : '2026-08-31T00:00:00Z' }] }) : db.query(sql, values) };
    expect(await visitPageRepair(clock, { scope: 'disposable', libraryId: 1 })).toMatchObject({ status: 'in_progress', counts: null });
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'clock_regression', counts: null });
    await visit();
    expect(await visit(1, now + 8 * 86400000)).toMatchObject({ status: 'restart_required', reason: 'state_expired', counts: null });
});

test('repairs the oldest invalidated page despite new changes to a lower page', async () => {
    await db.query('INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(1,1),(20001,1),(40001,1)');
    await visit(); await visit(); await visit();
    await db.query("UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id IN (1,20001)");
    expect((await visit()).status).toBe('in_progress');
    await db.query("UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id=1");
    expect((await visit()).status).toBe('in_progress');
    const pages = (await db.query('SELECT page_id FROM page_repair_lab.page_repair_pages WHERE dirty_since IS NOT NULL')).rows;
    expect(pages).toEqual([{ page_id: 0 }]);
    expect((await visit()).status).toBe('complete');
});

test('global page and library capacity are refused before metadata reads', async () => {
    await db.query(`INSERT INTO page_repair_lab.page_repair_source(id,library_id)
        SELECT n*20000+1,1 FROM generate_series(0,128) n`);
    for (let n = 0; n < 128; n++) expect((await visit()).metadataRowsRead).toBe(1);
    expect((await counts()).pages).toBe(128);
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'page_capacity', metadataRowsRead: 0, counts: null });
    expect((await counts()).pages).toBe(0);
    for (let id = 2; id <= 33; id++) await visit(id);
    expect((await counts()).libraries).toBe(32);
    expect(await visit(34)).toMatchObject({ status: 'restart_required', reason: 'library_capacity', counts: null });
});

test('behind-cursor placeholders obey the global page cap', async () => {
    await db.query(`INSERT INTO page_repair_lab.page_repair_source(id,library_id)
        SELECT n*20000+1,1 FROM generate_series(1,128) n`);
    for (let n = 0; n < 128; n++) await visit();
    await db.query('INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(1,1)');
    expect(await visit()).toMatchObject({ status: 'restart_required', reason: 'page_capacity', counts: null });
});

test('bounded indexed range projection withholds oversized observations', async () => {
    await seed(80001);
    await db.query(`UPDATE page_repair_lab.page_repair_source SET metadata=jsonb_build_object('inventory_tmdb',repeat('x',5000)) WHERE id=1`);
    const items = (await db.query(pageRepairSourceSql('disposable'), [1, 1, 20000])).rows;
    expect(items).toHaveLength(20000);
    expect(items[0]).toMatchObject({ observation_withheld: true, metadata: { inventory_tmdb: null } });
    const plan = (await db.query(`EXPLAIN (ANALYZE,FORMAT JSON) ${pageRepairSourceSql('disposable')}`, [1, 1, 20000])).rows[0]['QUERY PLAN'][0].Plan;
    const scans = [];
    const walk = node => { if (node['Relation Name'] === 'page_repair_source') scans.push(node); for (const child of node.Plans ?? []) walk(child); };
    walk(plan);
    // Either the primary-key range or the composite range index is valid: at most 20,000 IDs can exist here.
    expect(scans.some(node => node['Index Cond']?.includes('id'))).toBe(true);
    expect(scans.every(node => node['Actual Rows'] + (node['Rows Removed by Filter'] ?? 0) <= 20000)).toBe(true);
});

test('temporary Compose installation rolls back all objects and never overwrites existing source tables', async () => {
    await db.query('BEGIN');
    await installPageRepairPrototype(db, 'temporary');
    await seedPageRepairFixture(db, 'temporary', 1);
    expect(await visitPageRepairInTransaction(pageRepairClock(db, now), { scope: 'temporary', libraryId: 1 })).toMatchObject({ status: 'complete' });
    await db.query('ROLLBACK');
    expect((await db.query("SELECT to_regclass('pg_temp.page_repair_source') IS NULL AS absent")).rows[0].absent).toBe(true);
    await db.query('BEGIN');
    await expect(installPageRepairPrototype(db, 'disposable')).rejects.toMatchObject({ code: '42P06' });
    await db.query('ROLLBACK');
});

test('source changes and their journal publication roll back together', async () => {
    await seed(1); const before = await visit();
    await db.query("BEGIN; UPDATE page_repair_lab.page_repair_source SET metadata='{}'; ROLLBACK");
    expect(await visit()).toMatchObject({ sequence: before.sequence, counts: { captured: 1 } });
});

test('a failed summary write rolls back its cursor and allows a clean retry', async () => {
    await seed(1);
    const faulty = { query: (sql, values) => sql.startsWith('INSERT INTO page_repair_lab.page_repair_pages') ?
        db.query('SELECT 1/0') : pageRepairClock(db, now).query(sql, values) };
    await expect(visitPageRepair(faulty, { scope: 'disposable', libraryId: 1 })).rejects.toMatchObject({ code: '22012' });
    expect(await counts()).toMatchObject({ pages: 0, libraries: 0 });
    expect(await visit()).toMatchObject({ status: 'complete', counts: { captured: 1 } });
});

test('global page capacity does not evict a different library to admit another', async () => {
    await db.query(`INSERT INTO page_repair_lab.page_repair_source(id,library_id)
        SELECT n*20000+1,1 FROM generate_series(0,127) n`);
    for (let n = 0; n < 128; n++) await visit();
    await db.query('INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(2,2)');
    expect(await visit(2)).toMatchObject({ status: 'restart_required', reason: 'page_capacity', counts: null });
    expect((await counts()).pages).toBe(128);
    expect(await visit()).toMatchObject({ status: 'complete', counts: { inventory: 128 } });
});

test('a real concurrent writer cannot commit between locked source measurement and publication', async () => {
    await seed(1);
    const writer = await getPool().connect();
    let pending;
    try {
        await db.query('BEGIN');
        await db.query('SELECT * FROM page_repair_lab.page_repair_head FOR UPDATE');
        await writer.query("BEGIN; SET LOCAL lock_timeout='5s'");
        const pid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        pending = writer.query("UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id=1");
        // Observe the actual blocked writer; do not infer blocking from elapsed time alone.
        let blocked = false;
        for (let attempt = 0; attempt < 40 && !blocked; attempt++) {
            blocked = (await getPool().query('SELECT cardinality(pg_blocking_pids($1))>0 AS blocked', [pid])).rows[0].blocked;
            if (!blocked) await new Promise(resolve => { setTimeout(resolve, 20); });
        }
        expect(blocked).toBe(true);
        expect(await visitPageRepairInTransaction(pageRepairClock(db, now), { scope: 'disposable', libraryId: 1 })).toMatchObject({ counts: { captured: 1 } });
        await db.query('COMMIT');
        await pending;
        await writer.query('COMMIT');
        expect(await visit()).toMatchObject({ counts: { captured: 0 } });
    } finally {
        await db.query('ROLLBACK');
        if (pending) await pending.catch(() => {}); // swallow-error: Cleanup preserves the primary assertion/query failure; success already awaits this writer above.
        await writer.query('ROLLBACK'); writer.release();
    }
});

test('lock timeout aborts the visit without partial state or a leaked transaction', async () => {
    await seed(1);
    const writer = await getPool().connect();
    try {
        await writer.query("BEGIN; UPDATE page_repair_lab.page_repair_source SET metadata='{}'");
        await expect(visit()).rejects.toMatchObject({ code: '55P03' });
        await writer.query('ROLLBACK');
        expect((await counts()).libraries).toBe(0);
        expect(await visit()).toMatchObject({ counts: { captured: 1 } });
    } finally { await writer.query('ROLLBACK'); writer.release(); }
});
