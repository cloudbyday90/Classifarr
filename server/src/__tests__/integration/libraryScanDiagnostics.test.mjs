/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { setupObservationScanTables } from './helpers/setupObservationScanTables.mjs';
import { captureLibraryObservationSample } from '../../services/libraryObservationSample.mjs';
import { readLibraryObservationHistory } from '../../services/libraryObservationHistory.mjs';

let db;
beforeEach(async () => {
    db = await getPool().connect(); await db.query('BEGIN'); await setupObservationScanTables(db);
});
afterEach(async () => { await db.query('ROLLBACK'); db.release(); });
const at = minutes => ({ query: (sql, values) => db.query(sql.replaceAll('statement_timestamp()',
    `(transaction_timestamp() - INTERVAL '${minutes} minutes')`), values) });
const visit = minutes => captureLibraryObservationSample(at(minutes));
const diagnostics = async () => (await readLibraryObservationHistory(at(0))).scanDiagnostics;

test('catalog counts currently active libraries and caps sorted unvisited examples at twelve', async () => {
    await db.query("INSERT INTO libraries SELECT id,'PRIVATE',true FROM generate_series(4,20) id");
    await visit(0);
    const report = await diagnostics();
    expect(report.catalog).toEqual({ activeLibraryCount: 19, withIncrementalVisits: 1, withCompletedScans: 1,
        withoutCompletedScans: 18, withoutIncrementalVisits: 18, unvisitedPreviewLimit: 12,
        unvisitedLibraryIds: [2,4,5,6,7,8,9,10,11,12,13,14], unvisitedOmittedCount: 6 });
    expect(report.libraries[0]).toMatchObject({ libraryId: 1, isActive: true, completedScans: 1 });
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|populationFingerprint|continuitySince|revision|after_id/);
});

test('legacy complete visits remain unvisited by the incremental measurement definition', async () => {
    await visit(0);
    await db.query('UPDATE library_observation_points SET measurement_version=2,scan_started_at=NULL,scanned_rows=NULL');
    expect(await diagnostics()).toMatchObject({ catalog: { withIncrementalVisits: 0, withCompletedScans: 0,
        withoutCompletedScans: 2, unvisitedLibraryIds: [1,2] }, libraries: [{ completionEvidence: 'legacy_only', completedScans: 0 }] });
});

test('deleted or inactive history stays visible but cannot inflate active completion totals', async () => {
    await visit(10); await visit(5);
    await db.query('UPDATE libraries SET is_active=false WHERE id=1; DELETE FROM libraries WHERE id=2');
    const report = await diagnostics();
    expect(report.catalog).toMatchObject({ activeLibraryCount: 0, withCompletedScans: 0, withoutIncrementalVisits: 0, unvisitedLibraryIds: [] });
    expect(report.libraries.map(item => item.isActive)).toEqual([false, false]);
});

test('expired and future visits do not establish completion or catalog coverage', async () => {
    await visit(0);
    // Preserve the weekly slot/check constraint while moving the observation outside the retained window.
    await db.query("UPDATE library_observation_points SET observed_at=observed_at-INTERVAL '7 days',scan_started_at=scan_started_at-INTERVAL '7 days',continuity_since=continuity_since-INTERVAL '7 days'");
    expect(await diagnostics()).toMatchObject({ libraries: [], catalog: { withCompletedScans: 0, withoutIncrementalVisits: 2 } });
    await db.query("UPDATE library_observation_points SET observed_at=observed_at+INTERVAL '14 days',scan_started_at=scan_started_at+INTERVAL '14 days',continuity_since=continuity_since+INTERVAL '14 days'");
    expect((await diagnostics()).libraries).toEqual([]);
});

test('history diagnoses repeated real sampler restarts and resets the finding only after completion', async () => {
    await db.query(`INSERT INTO library_profile_inventory_state(library_id,revision) VALUES(1,1);
        INSERT INTO media_server_items(id,library_id,media_type,tmdb_id,metadata)
        SELECT id,1,'movie',7,'{}' FROM generate_series(3,20002) id`);
    await visit(30); await visit(25);
    await db.query('UPDATE library_profile_inventory_state SET revision=revision+1');
    await visit(20); await visit(15);
    await db.query('UPDATE library_profile_inventory_state SET observation_clock_revision=observation_clock_revision+1');
    await visit(10);
    expect((await diagnostics()).libraries[0]).toMatchObject({ completedScans: 0, restartsSinceCompletion: 2, repeatedResets: true });
    await visit(5); await visit(0);
    expect((await diagnostics()).libraries[0]).toMatchObject({ completedScans: 1, restartsSinceCompletion: 0,
        repeatedResets: false, lastCompletedDurationMinutes: 10,
        restartReasons: { inventory_changed: 1, observation_clocks_changed: 1 } });
});

test('one read-only statement scans the bounded history and catalog without inventory or progress access', async () => {
    await visit(0);
    let statement;
    let reads = 0;
    const before = (await db.query('SELECT * FROM library_observation_sampling_state')).rows;
    await readLibraryObservationHistory({ query: (sql, values) => { statement = sql; reads++; return db.query(sql, values); } });
    expect(reads).toBe(1);
    const result = await db.query(`EXPLAIN (ANALYZE,FORMAT JSON) ${statement}`);
    const relations = [];
    const walk = node => { if (node['Relation Name']) relations.push(node['Relation Name']);
        for (const child of node.Plans ?? []) walk(child); };
    walk(result.rows[0]['QUERY PLAN'][0].Plan);
    expect(relations).toContain('libraries');
    expect(relations).not.toContain('media_server_items');
    expect(relations).not.toContain('library_observation_scan_progress');
    expect((await db.query('SELECT * FROM library_observation_sampling_state')).rows).toEqual(before);
});

test('the maximum retained library spread remains bounded without returning the whole active catalog', async () => {
    await visit(0);
    await db.query(`INSERT INTO libraries SELECT id,'PRIVATE',true FROM generate_series(4,2030) id;
        INSERT INTO library_observation_points SELECT
        mod(floor(extract(epoch FROM observed_at-offset_slots*INTERVAL '5 minutes')/300)::bigint,2016),
        observed_at-offset_slots*INTERVAL '5 minutes',offset_slots+3,status,acquisition_configured,
        continuity_since-offset_slots*INTERVAL '5 minutes',inventory_lower_bound,population_fingerprint,
        inventory_rows,supported_rows,identified_rows,captured_rows,fresh_rows,keyword_rows,language_rows,
        measurement_version,scan_started_at-offset_slots*INTERVAL '5 minutes',scanned_rows,restart_reason
        FROM library_observation_points CROSS JOIN generate_series(1,2015) offset_slots`);
    const report = await readLibraryObservationHistory(at(0));
    expect(report.librarySamples).toHaveLength(2016);
    expect(report.scanDiagnostics.libraries).toHaveLength(2016);
    expect(report.scanDiagnostics.catalog).toMatchObject({ activeLibraryCount: 2029,
        withCompletedScans: 2016, withoutIncrementalVisits: 13, unvisitedOmittedCount: 1 });
    expect(report.scanDiagnostics.catalog.unvisitedLibraryIds).toHaveLength(12);
    expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThan(4000000);
});
