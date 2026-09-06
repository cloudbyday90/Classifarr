/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { installScopedRepairPrototype } from './schema.mjs';
import { seedScopedFixture } from './fixture.mjs';
import { withScopedRepairLibraries } from './locking.mjs';
import { visitScopedRepair } from './visit.mjs';
import { measureScopedConcurrency } from './concurrency.mjs';
import { SCOPED_REPAIR_LIMITS as limits } from './contract.mjs';
import { pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME as now } from '../libraryPageRepair/fixture.mjs';

async function isolated(db, work) {
    let installed = false;
    await db.query('BEGIN');
    try {
        await installScopedRepairPrototype(db, 'disposable'); await db.query('COMMIT'); installed = true;
        return await work();
    } finally {
        await db.query('ROLLBACK');
        if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE');
    }
}

async function scenario(db, rows, churn) {
    return isolated(db, async () => {
        await seedScopedFixture(db, { rows });
        for (let libraryId = 2; libraryId <= 15; libraryId++) await seedScopedFixture(db, { rows: 1, libraryId, offset: 100000 + libraryId });
        const report = { rows, churn, slots: 90, libraryCount: 15, completedVisits: 0, firstCompletionMinutes: null,
            otherLibraryVisits: 0, maximumOtherLibraryGapMinutes: 75, maximumMetadataRowsPerTurn: 0,
            maximumIdSeekRowsPerTurn: 0, maximumVisitMs: 0, maximumMutationMs: 0, restarts: 0, oracleMatched: true };
        for (let slot = 0; slot < 90; slot++) {
            if (churn !== 'stable') {
                const before = performance.now();
                await withScopedRepairLibraries(db, 'disposable', [1], 'write', ns => db.query(`UPDATE ${ns}.scoped_repair_source
                    SET metadata=CASE WHEN $1::boolean THEN '{}'::jsonb ELSE jsonb_build_object('inventory_tmdb',
                        jsonb_build_object('version',1,'tmdb_id',id,'media_type','movie','keywords',jsonb_build_array('space'),
                            'original_language','en')) END WHERE library_id=1 AND (id=1 OR ($2::boolean AND (id-1)%20000=0))`,
                [slot % 2 === 0, churn === 'every_page']));
                report.maximumMutationMs = Math.max(report.maximumMutationMs, performance.now() - before);
            }
            const libraryId = slot % 15 + 1, before = performance.now();
            const result = await visitScopedRepair(pageRepairClock(db, now + slot * 300000), { scope: 'disposable', libraryId });
            report.maximumVisitMs = Math.max(report.maximumVisitMs, performance.now() - before);
            if (result.status === 'complete') {
                // Independent known-fixture oracle: only whole generated observations or empty objects are written.
                const count = libraryId === 1 ? rows : 1;
                const captured = (await db.query("SELECT count(*)::integer n FROM scoped_repair_lab.scoped_repair_source WHERE library_id=$1 AND metadata<>'{}'::jsonb", [libraryId])).rows[0].n;
                const expected = { inventory: count, supported: count, identified: count, captured, fresh: captured, keywords: captured, language: captured };
                if (Object.keys(expected).some(field => result.counts[field] !== expected[field])) throw new Error('Scoped repair fixture oracle mismatch');
                if (libraryId === 1) { report.completedVisits++; report.firstCompletionMinutes ??= slot * 5; }
            }
            if (libraryId !== 1) report.otherLibraryVisits++;
            if (result.status === 'restart_required') report.restarts++;
            report.maximumMetadataRowsPerTurn = Math.max(report.maximumMetadataRowsPerTurn, result.metadataRowsRead);
            report.maximumIdSeekRowsPerTurn = Math.max(report.maximumIdSeekRowsPerTurn, result.lookaheadRowsRead);
        }
        const allocation = (await db.query(`SELECT (SELECT count(*)::integer FROM scoped_repair_lab.scoped_repair_heads WHERE library_id IS NOT NULL) libraries,
            (SELECT count(*)::integer FROM scoped_repair_lab.scoped_repair_pages WHERE owner IS NOT NULL) pages`)).rows[0];
        if (report.maximumMetadataRowsPerTurn > limits.rows || report.maximumIdSeekRowsPerTurn > limits.rows + 1 || allocation.pages > limits.pages) throw new Error('Scoped repair budget exceeded');
        for (const key of ['maximumVisitMs', 'maximumMutationMs']) report[key] = Number(report[key].toFixed(2));
        return { ...report, allocation };
    });
}

export async function runScopedRepairMeasurements(db, { withClient }) {
    const scenarios = [];
    for (const rows of [20001, 40001, 80001]) for (const churn of ['stable', 'one_page', 'every_page']) scenarios.push(await scenario(db, rows, churn));
    const concurrency = await isolated(db, async () => {
        await seedScopedFixture(db, { rows: 1 }); await seedScopedFixture(db, { rows: 1, libraryId: 2, offset: 1 });
        return withClient(reader => withClient(writer => measureScopedConcurrency(db, reader, writer)));
    });
    const cleaned = (await db.query("SELECT to_regnamespace('scoped_repair_lab') IS NULL clean")).rows[0].clean;
    if (!cleaned) throw new Error('Scoped repair cleanup failed');
    return { contract: 'library.scoped-repair.benchmark.v1', productionPromotion: false, cleanupVerified: true,
        providerRequests: 0, productionWrites: 0, limits, scenarios, concurrency };
}
