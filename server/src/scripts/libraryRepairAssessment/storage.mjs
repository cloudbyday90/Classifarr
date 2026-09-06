/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { visitPageRepair } from '../libraryPageRepair/visit.mjs';
import { pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME } from '../libraryPageRepair/fixture.mjs';

async function footprint(db, phase) {
    const row = (await db.query(`SELECT (SELECT count(*)::integer FROM page_repair_lab.page_repair_journal) AS journal_rows,
        (SELECT count(*)::integer FROM page_repair_lab.page_repair_pages) AS page_rows,
        (SELECT sum(pg_total_relation_size(c.oid))::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='page_repair_lab' AND c.relname IN ('page_repair_head','page_repair_journal','page_repair_state','page_repair_pages')) AS bytes`)).rows[0];
    if (row.journal_rows > 256 || row.page_rows > 128) throw new Error('Repair storage row bound exceeded');
    return { phase, journalRows: row.journal_rows, pageRows: row.page_rows, relationBytes: Number(row.bytes) };
}

export async function measureRepairStorage(db) {
    const samples = [await footprint(db, 'initial')];
    const started = performance.now();
    for (let round = 1; round <= 16; round++) {
        for (let update = 0; update < 128; update++) {
            await db.query("UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id=1");
        }
        const result = await visitPageRepair(pageRepairClock(db, PAGE_REPAIR_BENCHMARK_TIME), { scope: 'disposable', libraryId: 1 });
        if (result.status !== 'complete' || result.counts.inventory !== 20001) throw new Error('Storage replay lost coherent coverage');
        samples.push(await footprint(db, `round_${round}`));
        if (round % 4 === 0) {
            // Only owned disposable relations; never VACUUM FULL or application maintenance.
            for (const table of ['head', 'journal', 'state', 'pages']) await db.query(`VACUUM (ANALYZE) page_repair_lab.page_repair_${table}`);
            samples.push(await footprint(db, `vacuum_${round}`));
        }
    }
    return { committedUpdates: 2048, journalWraps: 8, ordinaryVacuumRounds: 4, samples,
        elapsedMs: Number((performance.now() - started).toFixed(2)), hardPhysicalByteLimitProven: false };
}

/** Same source shape and indexes, with/without change capture; single fixed-order run. */
export async function measureRepairBulkChanges(db) {
    await db.query(`CREATE TABLE page_repair_lab.page_repair_untracked (LIKE page_repair_lab.page_repair_source INCLUDING ALL);
        INSERT INTO page_repair_lab.page_repair_untracked SELECT * FROM page_repair_lab.page_repair_source`);
    const samples = [];
    for (const [scenario, libraryId] of [['single_row', 2], ['dense_20001_rows', 1], ['sparse_257_ranges', 4]]) {
        for (const tracked of [false, true]) {
            const table = tracked ? 'page_repair_source' : 'page_repair_untracked';
            const before = (await db.query('SELECT generation::text FROM page_repair_lab.page_repair_head')).rows[0].generation;
            const started = performance.now();
            const result = await db.query(`UPDATE page_repair_lab.${table} SET inventory_tmdb_attempted_at=NULL WHERE library_id=$1`, [libraryId]);
            const elapsedMs = Number((performance.now() - started).toFixed(2));
            const after = (await db.query('SELECT generation::text FROM page_repair_lab.page_repair_head')).rows[0].generation;
            samples.push({ scenario, tracked, affectedRows: result.rowCount, elapsedMs, generationInvalidated: before !== after });
        }
    }
    return samples;
}
