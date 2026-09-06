/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createRecoveryBenchmarkFixture } from '../../scripts/libraryScanRecovery/fixture.mjs';
import { probeLibraryScanRecovery } from '../../scripts/libraryScanRecovery/probe.mjs';
import { RECOVERY_SOURCE_SQL } from '../../scripts/libraryScanRecovery/projection.mjs';
import { setupObservationScanTables } from './helpers/setupObservationScanTables.mjs';
import { captureLibraryObservationSample } from '../../services/libraryObservationSample.mjs';
import { readLibraryObservationHistory } from '../../services/libraryObservationHistory.mjs';

let db;
beforeEach(async () => { db = await getPool().connect(); await db.query('BEGIN'); });
afterEach(async () => { await db.query('ROLLBACK'); db.release(); });

test.each(['current', 'two_page_visit', 'frozen_projection'])('refuses %s without owned temporary tables', async strategy => {
    await expect(probeLibraryScanRecovery(db, strategy)).rejects.toThrow('temporary fixture');
});
test('validates scenarios and fixture bounds before any source work', async () => {
    await expect(createRecoveryBenchmarkFixture(db, 80002)).rejects.toThrow('fixture size');
    await expect(probeLibraryScanRecovery(db, 'unbounded')).rejects.toThrow('strategy');
});
test.each([20000, 20001, 40000, 40001])('current and capped two-page prototypes enforce exact bounds for %i rows', async rows => {
    await createRecoveryBenchmarkFixture(db, rows);
    for (const strategy of ['current', 'two_page_visit']) {
        const limit = strategy === 'current' ? 20000 : 40000;
        const result = await probeLibraryScanRecovery(db, strategy);
        expect(result.complete).toBe(rows <= limit);
        expect(result.metadataRowsRead).toBe(Math.min(rows, limit));
        expect(result.lookaheadRows).toBe(Math.min(rows, limit + 1));
        expect(result.counts).toEqual(rows > limit ? null : { inventory: rows, supported: rows, identified: rows,
            captured: rows, fresh: rows, keywords: rows, language: rows });
        expect(result.storedRows).toBe(0);
    }
});
test('frozen compact flags remain correct after actual source mutation and omit metadata', async () => {
    await createRecoveryBenchmarkFixture(db, 20001);
    const result = await probeLibraryScanRecovery(db, 'frozen_projection');
    expect(result).toMatchObject({ complete: true, storedRows: 20001, frozenUnaffectedByChange: true,
        counts: { inventory: 20001, captured: 20001 } });
    expect(result.storageBytes).toBeGreaterThan(0);
    expect((await db.query("SELECT count(*)::integer n FROM pg_temp.recovery_benchmark_source WHERE metadata='{}'")).rows[0].n).toBe(20001);
    expect(JSON.stringify(result)).not.toMatch(/space|inventory_tmdb|metadata"|tmdb_id|password/);
});
test('oversized frozen projections refuse before reading metadata or writing storage', async () => {
    await createRecoveryBenchmarkFixture(db, 40001);
    expect(await probeLibraryScanRecovery(db, 'frozen_projection')).toMatchObject({ complete: false,
        capacityRefused: true, metadataRowsRead: 0, storedRows: 0, storageBytes: 0, counts: null });
    expect((await db.query("SELECT count(*)::integer n FROM pg_temp.recovery_benchmark_source WHERE metadata='{}'")).rows[0].n).toBe(0);
});
test('the prototype uses the production predicate for malformed, oversized and untrusted observations', async () => {
    await createRecoveryBenchmarkFixture(db, 4);
    await db.query(`UPDATE pg_temp.recovery_benchmark_source SET metadata='{"inventory_tmdb":{"version":999}}' WHERE id=1;
        UPDATE pg_temp.recovery_benchmark_source SET metadata=jsonb_build_object('inventory_tmdb',repeat('x',5000)) WHERE id=2;
        UPDATE pg_temp.recovery_benchmark_source SET tmdb_id=NULL WHERE id=3`);
    expect((await probeLibraryScanRecovery(db, 'two_page_visit')).counts).toEqual({ inventory: 4,
        supported: 4, identified: 3, captured: 1, fresh: 1, keywords: 1, language: 1 });
});
test('lookahead and metadata lookup remain bounded on larger source populations', async () => {
    await createRecoveryBenchmarkFixture(db, 80001);
    const plan = (await db.query(`EXPLAIN (ANALYZE,FORMAT JSON) ${RECOVERY_SOURCE_SQL}`, [40001, 40000, false])).rows[0]['QUERY PLAN'][0].Plan;
    const scans = [];
    const walk = node => { if (node['Relation Name'] === 'recovery_benchmark_source') scans.push(node);
        for (const child of node.Plans ?? []) walk(child); };
    walk(plan);
    expect(scans.some(node => node['Index Cond']?.includes('library_id'))).toBe(true);
    expect(scans.every(node => node['Actual Rows'] <= 40001)).toBe(true);
});

test.each(['READ COMMITTED', 'REPEATABLE READ'])('actual concurrent page reads expose the %s snapshot boundary', async isolation => {
    // Ordinary table only inside this disposable integration database so both sessions can see it.
    await getPool().query(`CREATE TABLE recovery_snapshot_probe(id integer PRIMARY KEY,captured boolean);
        INSERT INTO recovery_snapshot_probe VALUES(1,true),(2,false)`);
    const reader = await getPool().connect();
    const writer = await getPool().connect();
    try {
        await reader.query(`BEGIN ISOLATION LEVEL ${isolation} READ ONLY`);
        const first = (await reader.query('SELECT captured FROM recovery_snapshot_probe WHERE id=1')).rows[0].captured;
        await writer.query('UPDATE recovery_snapshot_probe SET captured=NOT captured');
        const second = (await reader.query('SELECT captured FROM recovery_snapshot_probe WHERE id=2')).rows[0].captured;
        // Both actual database versions contain one captured row; read committed can mix them into two.
        expect(Number(first) + Number(second)).toBe(isolation === 'REPEATABLE READ' ? 1 : 2);
    } finally {
        await reader.query('ROLLBACK'); reader.release(); writer.release();
        await getPool().query('DROP TABLE recovery_snapshot_probe');
    }
});

test('the production sampler confirms modeled starvation while preserving turns for fourteen smaller libraries', async () => {
    await setupObservationScanTables(db);
    await db.query(`INSERT INTO libraries SELECT id,'Controlled small library',true FROM generate_series(4,16) id;
        INSERT INTO library_profile_inventory_state(library_id,revision) VALUES(1,1);
        INSERT INTO media_server_items(id,library_id,media_type,tmdb_id,metadata)
        SELECT id,1,'movie',7,'{}' FROM generate_series(3,20002) id`);
    for (let slot = 0; slot < 45; slot++) {
        await db.query('UPDATE library_profile_inventory_state SET observation_clock_revision=observation_clock_revision+1 WHERE library_id=1');
        await captureLibraryObservationSample({ query: (sql, values) => db.query(sql.replaceAll('statement_timestamp()',
            `(transaction_timestamp() - INTERVAL '${(45 - slot) * 5} minutes')`), values) });
    }
    const report = await readLibraryObservationHistory(db);
    expect(report.scanDiagnostics.libraries.find(item => item.libraryId === 1)).toMatchObject({
        visitCount: 3, completedScans: 0, restartsSinceCompletion: 2, repeatedResets: true });
    expect(report.scanDiagnostics.libraries.filter(item => item.libraryId !== 1)).toHaveLength(14);
    expect(report.scanDiagnostics.libraries.filter(item => item.libraryId !== 1).every(item => item.completedScans === 3)).toBe(true);
});
