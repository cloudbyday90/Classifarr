/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { installPageRepairPrototype } from './schema.mjs';
import { seedPageRepairFixture, pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME } from './fixture.mjs';
import { visitPageRepair } from './visit.mjs';
import { PAGE_REPAIR_LIMITS as limits } from './contract.mjs';

/** Known fixture expectations are independent of the production observation validator. */
async function assertFixtureCounts(db, result, libraryId, rows) {
    if (result.status !== 'complete') return;
    const captured = libraryId === 1 ? (await db.query(`SELECT count(*)::integer n FROM page_repair_lab.page_repair_source
        WHERE library_id=1 AND metadata<>'{}'::jsonb`)).rows[0].n : 0;
    const expected = { inventory: libraryId === 1 ? rows : 1, supported: libraryId === 1 ? rows : 1,
        identified: libraryId === 1 ? rows : 1, captured, fresh: captured, keywords: captured, language: captured };
    if (Object.keys(expected).some(field => expected[field] !== result.counts[field])) throw new Error('Page repair oracle mismatch');
}

async function measureScenario(db, rows, churn) {
    await db.query('BEGIN');
    let installed = false;
    try {
        await installPageRepairPrototype(db, 'disposable');
        await db.query('COMMIT');
        installed = true;
        await seedPageRepairFixture(db, 'disposable', rows);
        await db.query(`INSERT INTO page_repair_lab.page_repair_source(id,library_id,media_type,tmdb_id,metadata)
            SELECT 100000+n,n,'movie',100000+n,'{}'::jsonb FROM generate_series(2,15) n`);
        const report = { rows, churn, slots: 90, libraryCount: 15, completedVisits: 0, firstCompletionMinutes: null,
            otherLibraryVisits: 0, maximumOtherLibraryGapMinutes: 75, maximumMetadataRowsPerTurn: 0,
            maximumIdSeekRowsPerTurn: 0, maximumVisitMs: 0, maximumMutationMs: 0, maximumCachedPages: 0,
            maximumJournalEntries: 0, restarts: 0, oracleMatched: true };
        for (let slot = 0; slot < 90; slot++) {
            if (churn !== 'stable') {
                const before = performance.now();
                // Only controlled fixtures can reach this fixed disposable schema.
                await db.query(`UPDATE page_repair_lab.page_repair_source SET metadata=CASE WHEN $1::boolean THEN '{}'::jsonb
                    ELSE jsonb_build_object('inventory_tmdb',jsonb_build_object('version',1,'tmdb_id',id,'media_type','movie',
                        'keywords',jsonb_build_array('space'),'original_language','en')) END
                    WHERE library_id=1 AND (id=1 OR ($2::boolean AND (id-1)%${limits.pageWidth}=0))`, [slot % 2 === 0, churn === 'every_range']);
                report.maximumMutationMs = Math.max(report.maximumMutationMs, performance.now() - before);
            }
            const libraryId = slot % 15 + 1;
            const before = performance.now();
            const result = await visitPageRepair(pageRepairClock(db, PAGE_REPAIR_BENCHMARK_TIME + slot * 300000), { scope: 'disposable', libraryId });
            report.maximumVisitMs = Math.max(report.maximumVisitMs, performance.now() - before);
            await assertFixtureCounts(db, result, libraryId, rows);
            if (libraryId !== 1) report.otherLibraryVisits++;
            else if (result.status === 'complete') {
                report.completedVisits++;
                report.firstCompletionMinutes ??= slot * 5;
            }
            if (result.status === 'restart_required') report.restarts++;
            report.maximumMetadataRowsPerTurn = Math.max(report.maximumMetadataRowsPerTurn, result.metadataRowsRead);
            report.maximumIdSeekRowsPerTurn = Math.max(report.maximumIdSeekRowsPerTurn, result.lookaheadRowsRead);
            const storage = (await db.query(`SELECT (SELECT count(*)::integer FROM page_repair_lab.page_repair_pages) pages,
                (SELECT count(*)::integer FROM page_repair_lab.page_repair_journal) events`)).rows[0];
            report.maximumCachedPages = Math.max(report.maximumCachedPages, storage.pages);
            report.maximumJournalEntries = Math.max(report.maximumJournalEntries, storage.events);
        }
        report.storageBytes = Number((await db.query(`SELECT sum(pg_total_relation_size(c.oid))::text AS bytes
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='page_repair_lab' AND c.relkind='r' AND c.relname<>'page_repair_source'`)).rows[0].bytes);
        for (const key of ['maximumVisitMs', 'maximumMutationMs']) report[key] = Number(report[key].toFixed(2));
        return report;
    } finally {
        await db.query('ROLLBACK');
        // This name was created by this invocation in an allowlisted disposable database.
        if (installed) await db.query('DROP SCHEMA page_repair_lab CASCADE');
    }
}

export async function runPageRepairMeasurements(db) {
    const scenarios = [];
    for (const rows of [20001, 40001, 80001]) {
        for (const churn of ['stable', 'one_range', 'every_range']) scenarios.push(await measureScenario(db, rows, churn));
    }
    const cleaned = (await db.query("SELECT to_regnamespace('page_repair_lab') IS NULL AS clean")).rows[0].clean;
    if (!cleaned) throw new Error('Page repair cleanup failed');
    return { contract: 'library.page-repair.benchmark.v1', productionPromotion: false, cleanupVerified: cleaned,
        providerRequests: 0, productionWrites: 0, limits, scenarios };
}
