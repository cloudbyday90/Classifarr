/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { setupObservationScanTables } from './helpers/setupObservationScanTables.mjs';
import { captureLibraryObservationSample } from '../../services/libraryObservationSample.mjs';
import { readLibraryObservationSamplingSnapshot } from '../../services/libraryObservationSamplingQuery.mjs';
import { persistLibraryObservationSample } from '../../services/libraryObservationSamplingPersistence.mjs';
import { readLibraryObservationHistory } from '../../services/libraryObservationHistory.mjs';

let db;
beforeEach(async () => {
    db=await getPool().connect(); await db.query('BEGIN'); await setupObservationScanTables(db);
    await db.query(`INSERT INTO library_profile_inventory_state(library_id,revision) VALUES(1,9007199254740993),(2,1);
        INSERT INTO media_server_items(id,library_id,media_type,tmdb_id,metadata)
        SELECT id,1,'movie',7,'{}' FROM generate_series(3,20002) id`);
});
afterEach(async () => { await db.query('ROLLBACK'); db.release(); });
const at = minutesAgo => ({query:(sql,values)=>db.query(sql.replaceAll('statement_timestamp()',
    `(transaction_timestamp() - INTERVAL '${minutesAgo} minutes')`),values)});
const visit = minutesAgo => captureLibraryObservationSample(at(minutesAgo));
const latest = async () => (await readLibraryObservationHistory(db)).librarySamples[0];

test('exactly 20000 rows complete on one visit without an unnecessary continuation', async () => {
    await db.query('DELETE FROM media_server_items WHERE id=20002');
    await visit(0);
    expect(await latest()).toMatchObject({status:'available',inventoryRows:20000,scannedRows:20000});
    expect((await db.query('SELECT * FROM library_observation_scan_progress')).rows).toEqual([]);
});

test('observation gains between complete scans remain comparable when population is unchanged', async () => {
    await db.query('DELETE FROM media_server_items WHERE id>2');
    await visit(20); await visit(15);
    await db.query(`UPDATE media_server_items SET metadata='{"inventory_tmdb":{"version":1,"media_type":"movie","tmdb_id":7,"keywords":["space"],"original_language":"en"}}'
        WHERE library_id=1;
        UPDATE library_profile_inventory_state SET revision=revision+1 WHERE library_id=1`);
    await visit(10);
    expect(await latest()).toMatchObject({status:'available',comparison:'comparable',populationChanged:false,
        delta:{capturedRows:1,keywordRows:1,languageRows:1}});
});

test('completes two-page inventories fairly, with exact revision and stable repeated-scan digests', async () => {
    for (const minutes of [30,25,20,15,10,5,0]) await visit(minutes);
    const report=await readLibraryObservationHistory(db);
    expect(report.librarySamples.map(p=>[p.libraryId,p.status])).toEqual([
        [1,'available'],[2,'available'],[1,'in_progress'],[2,'available'],[1,'available'],[2,'available'],[1,'in_progress']]);
    expect(report.librarySamples[0]).toMatchObject({inventoryRows:20001,scannedRows:20001,comparison:'comparable',
        delta:{capturedRows:0},elapsedMinutes:20});
    expect(report.librarySamples[2]).toMatchObject({inventoryRows:null,scannedRows:20000});
    expect((await db.query('SELECT * FROM library_observation_scan_progress')).rows).toEqual([]);
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|9007199254740993|inventory_revision|populationFingerprint|after_id/);
});

test.each([
    ["UPDATE library_profile_inventory_state SET revision=revision+1 WHERE library_id=1",'inventory_changed'],
    ["UPDATE library_profile_inventory_state SET observation_clock_revision=1 WHERE library_id=1",'observation_clocks_changed'],
    ["UPDATE tmdb_config SET is_active=false",'configuration_changed'],
    ["UPDATE library_observation_scan_progress SET scan_started_at=scan_started_at-INTERVAL '7 days',last_visit_at=last_visit_at-INTERVAL '7 days'",'expired'],
])('restarts automatically after changed scan input: %s', async (mutation,reason) => {
    await visit(10); await visit(5); await db.query(mutation); await visit(0);
    expect(await latest()).toMatchObject({libraryId:1,status:'in_progress',scannedRows:20000,restartReason:reason,inventoryRows:null});
    const progress=(await db.query('SELECT inventory_revision::text FROM library_observation_scan_progress')).rows[0];
    expect(progress.inventory_revision).toBe(reason==='inventory_changed'?'9007199254740994':'9007199254740993');
});

test('a sampling gap restarts partial work, while normal library rotation resumes it', async () => {
    await visit(20); await visit(15); await visit(0);
    expect(await latest()).toMatchObject({status:'in_progress',restartReason:'sampling_gap',scannedRows:20000});
});

test('changes committed after reading discard both partial and completing pages atomically', async () => {
    await visit(10); await visit(5);
    const snapshot=await readLibraryObservationSamplingSnapshot(at(0));
    expect(snapshot.scan_context.inventory_revision).toBe('9007199254740993');
    await db.query('UPDATE library_profile_inventory_state SET revision=revision+1 WHERE library_id=1');
    await persistLibraryObservationSample(db,snapshot);
    expect(await latest()).toMatchObject({status:'invalidated',restartReason:'changed_before_write',scannedRows:0,inventoryRows:null});
    expect((await db.query('SELECT * FROM library_observation_scan_progress')).rows).toEqual([]);
});

test('freshness is measured at scan start even when an observation ages out before completion', async () => {
    await db.query(`UPDATE media_server_items SET metadata='{"inventory_tmdb":{"version":1,"media_type":"movie","tmdb_id":7,"keywords":["space"],"original_language":"en"}}',
        inventory_tmdb_fetched_at=statement_timestamp()-INTERVAL '30 days'-INTERVAL '5 minutes' WHERE library_id=1`);
    await visit(10); await visit(5); await visit(0);
    const point=await latest();
    expect(point).toMatchObject({status:'available',inventoryRows:20001,freshRows:20001,capturedRows:20001});
    expect(Date.parse(point.observedAt)-Date.parse(point.scanStartedAt)).toBeGreaterThanOrEqual(600000);
});
