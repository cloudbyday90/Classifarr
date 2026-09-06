/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { captureLibraryObservationSample } from '../../services/libraryObservationSample.mjs';
import { readLibraryObservationSamplingSnapshot } from '../../services/libraryObservationSamplingQuery.mjs';
import { persistLibraryObservationSample } from '../../services/libraryObservationSamplingPersistence.mjs';
import { setupObservationScanTables } from './helpers/setupObservationScanTables.mjs';
import { readLibraryObservationHistory } from '../../services/libraryObservationHistory.mjs';

let db;
beforeEach(async () => {
    db = await getPool().connect(); await db.query('BEGIN');
    await setupObservationScanTables(db);
});
afterEach(async () => { await db.query('ROLLBACK'); db.release(); });
const at = minutesAgo => ({ query: (sql, values) => db.query(sql.replaceAll('statement_timestamp()',
    `(transaction_timestamp() - INTERVAL '${minutesAgo} minutes')`), values) });
const visit = minutesAgo => captureLibraryObservationSample(at(minutesAgo));
const history = () => readLibraryObservationHistory(db);
const state = async () => (await db.query('SELECT * FROM library_observation_sampling_state')).rows[0];

test('visits beyond the first 12 libraries fairly and resumes durable progress', async () => {
    await db.query("UPDATE libraries SET is_active=true; INSERT INTO libraries SELECT id,'Library',true FROM generate_series(4,15) id");
    for (let index=0; index<16; index++) await visit((15-index)*5);
    const points=(await history()).librarySamples;
    expect([...points].reverse().map(row=>row.libraryId)).toEqual([...Array.from({length:15},(_,i)=>i+1),1]);
    expect(points[0]).toMatchObject({ comparison:'comparable',elapsedMinutes:75,unchangedComparisons:1 });
    expect((await state()).last_library_id).toBe(1);
    expect(JSON.stringify(points)).not.toMatch(/PRIVATE|populationFingerprint|continuitySince/);
});

test('a partial large-library scan advances without withholding a smaller library', async () => {
    await db.query(`INSERT INTO media_server_items(id,library_id,media_type,tmdb_id,metadata)
        SELECT id,1,'movie',7,'{}' FROM generate_series(3,20002) id`);
    await visit(5); await visit(0);
    const points=(await history()).librarySamples;
    expect(points[0]).toMatchObject({libraryId:2,status:'available',inventoryRows:1});
    expect(points[1]).toMatchObject({libraryId:1,status:'in_progress',scannedRows:20000,inventoryLowerBound:20001,
        inventoryRows:null,capturedRows:null,delta:null});
});

test('new higher IDs wait for the next bounded pass instead of postponing wrap forever', async () => {
    await visit(15);
    await db.query("INSERT INTO libraries SELECT id,'New',true FROM generate_series(4,10) id");
    await visit(10); expect((await state()).last_library_id).toBe(2);
    await visit(5); expect((await state()).last_library_id).toBe(1);
    expect((await state()).ceiling_library_id).toBe(10);
    await visit(0); expect((await state()).last_library_id).toBe(2);
});

test('deletions, inactivity, reactivation and an empty catalog do not wedge the cursor', async () => {
    await visit(20); await db.query('DELETE FROM libraries WHERE id=2; UPDATE libraries SET is_active=false');
    expect(await visit(15)).toEqual({captured:false}); expect((await state()).last_library_id).toBe(0);
    await db.query('UPDATE libraries SET is_active=true WHERE id=3'); await visit(10);
    expect((await state()).last_library_id).toBe(3);
    await db.query('UPDATE libraries SET is_active=true WHERE id=1'); await visit(5); await visit(0);
    expect((await history()).librarySamples.map(row=>row.libraryId)).toEqual([3,1,3,1]);
});

test('same-slot or stale claims cannot consume a second library', async () => {
    const first=await readLibraryObservationSamplingSnapshot(at(0));
    const stale=await readLibraryObservationSamplingSnapshot(at(0));
    expect(await persistLibraryObservationSample(db,first)).toEqual({captured:true});
    expect(await persistLibraryObservationSample(db,stale)).toEqual({captured:false});
    expect(await visit(0)).toEqual({captured:false});
    expect((await history()).librarySamples).toHaveLength(1); expect((await state()).last_library_id).toBe(1);
});

test('failed point persistence rolls back cursor and continuity progress', async () => {
    const snapshot=await readLibraryObservationSamplingSnapshot(at(0));
    await db.query('SAVEPOINT invalid_point');
    const invalidWriter={query:(sql,values)=>db.query(sql,[JSON.stringify({...JSON.parse(values[0]),scanned_rows:-1})])};
    await expect(persistLibraryObservationSample(invalidWriter,snapshot)).rejects.toThrow();
    await db.query('ROLLBACK TO SAVEPOINT invalid_point');
    expect((await state()).last_sample_at).toBeNull(); expect((await history()).librarySamples).toEqual([]);
});

test('normal rotation compares, but missed slots, changed populations and configuration do not', async () => {
    await visit(35); await visit(30); await visit(25);
    expect((await history()).librarySamples[0].comparison).toBe('comparable');
    await visit(15); await visit(10);
    expect((await history()).librarySamples[0].comparison).toBe('sampling_gap');
    await db.query('UPDATE media_server_items SET tmdb_id=99 WHERE library_id=1');
    await visit(5); await visit(0);
    expect((await history()).librarySamples[0]).toMatchObject({comparison:'population_changed',populationChanged:true});
});

test('expired/future points stay hidden and fixed slots cap storage at 2016', async () => {
    await visit(0);
    await db.query(`INSERT INTO library_observation_points SELECT
        mod(floor(extract(epoch FROM observed_at-offset_slots*INTERVAL '5 minutes')/300)::bigint,2016),
        observed_at-offset_slots*INTERVAL '5 minutes',library_id,status,acquisition_configured,
        continuity_since-offset_slots*INTERVAL '5 minutes',inventory_lower_bound,population_fingerprint,
        inventory_rows,supported_rows,identified_rows,captured_rows,fresh_rows,keyword_rows,language_rows,
        measurement_version,scan_started_at-offset_slots*INTERVAL '5 minutes',scanned_rows,restart_reason
        FROM library_observation_points CROSS JOIN generate_series(1,2015) offset_slots`);
    expect((await history()).librarySamples).toHaveLength(2016);
    expect(Buffer.byteLength(JSON.stringify(await history()))).toBeLessThan(2000000);
    await db.query("UPDATE library_observation_points SET observed_at=observed_at-INTERVAL '7 days',continuity_since=continuity_since-INTERVAL '7 days',scan_started_at=scan_started_at-INTERVAL '7 days'");
    expect((await history()).librarySamples).toEqual([]);
    await db.query('UPDATE library_observation_sampling_state SET last_sample_at=NULL,continuity_since=NULL'); await visit(0);
    expect((await db.query('SELECT COUNT(*)::int n FROM library_observation_points')).rows[0].n).toBe(2016);
    await db.query("UPDATE library_observation_points SET observed_at=observed_at+INTERVAL '14 days',continuity_since=continuity_since+INTERVAL '14 days',scan_started_at=scan_started_at+INTERVAL '14 days'");
    expect((await history()).librarySamples).toEqual([]);
});

test('clock regressions pause sampling and expose a clock anomaly instead of overwriting future points', async () => {
    await visit(0);
    await db.query("UPDATE library_observation_sampling_state SET last_sample_at=last_sample_at+INTERVAL '1 day'");
    expect(await visit(0)).toEqual({captured:false});
    expect((await history()).librarySampling.status).toBe('clock_anomaly');
});

test('snapshot seed initializes missing state without resetting an existing cursor', async () => {
    const seed=await readFile(new URL('../../../../database/migrations/20260905_210000_seed_library_sampling_state.sql',import.meta.url),'utf8');
    const localSeed=seed.replaceAll('public.library_observation_sampling_state','pg_temp.library_observation_sampling_state');
    await visit(0); const before=await state(); await db.query(localSeed);
    expect(await state()).toEqual(before);
    await db.query('DELETE FROM library_observation_sampling_state'); await db.query(localSeed);
    expect((await state()).last_sample_at).toBeNull(); expect((await state()).last_library_id).toBe(0);
    const schema=await readFile(new URL('../../../../database/schema/current.sql',import.meta.url),'utf8');
    expect(schema).toContain(seed.trim());
});

test('indexed library lookup stops at the capacity sentinel without scanning another library', async () => {
    await db.query(`INSERT INTO media_server_items(id,library_id,media_type,tmdb_id,metadata)
        SELECT id,CASE WHEN id<=20002 THEN 1 ELSE 2 END,'movie',7,'{}' FROM generate_series(3,120000) id;
        ANALYZE media_server_items`);
    let statement, parameters;
    const snapshot=await readLibraryObservationSamplingSnapshot({query:(sql,values)=>{
        statement=sql; parameters=values; return db.query(sql,values);
    }});
    expect(snapshot.row_count).toBe(20000); expect(snapshot.items).toHaveLength(20000); expect(snapshot.has_more).toBe(true);
    const result=await db.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${statement}`,parameters);
    const plan=result.rows[0]['QUERY PLAN'][0].Plan;
    const scans=[];
    const walk=node=>{ if(node['Relation Name']==='media_server_items') scans.push({
        type:node['Node Type'],index:node['Index Name'],condition:node['Index Cond'],filter:node.Filter,
        rows:node['Actual Rows'],removed:node['Rows Removed by Filter'],loops:node['Actual Loops']});
        for(const child of node.Plans || []) walk(child); };
    walk(plan);
    expect(scans).toEqual(expect.arrayContaining([expect.objectContaining({condition:expect.stringContaining('library_id')})]));
    expect(scans.every(scan=>scan.rows<=20001)).toBe(true);
});

test('two actual database sessions cannot claim the same sampling cursor twice', async () => {
    // A dedicated schema inside this disposable integration database makes the race visible to both sessions.
    await getPool().query(`CREATE SCHEMA sampler_race;
        CREATE TABLE sampler_race.library_observation_sampling_state (LIKE public.library_observation_sampling_state INCLUDING ALL);
        CREATE TABLE sampler_race.library_observation_points (LIKE public.library_observation_points INCLUDING ALL);
        CREATE TABLE sampler_race.library_profile_inventory_state (LIKE public.library_profile_inventory_state INCLUDING ALL);
        CREATE TABLE sampler_race.library_observation_scan_progress (LIKE public.library_observation_scan_progress INCLUDING ALL);
        CREATE TABLE sampler_race.libraries(id integer PRIMARY KEY,name text,is_active boolean);
        CREATE TABLE sampler_race.media_server_items(id integer PRIMARY KEY,library_id integer,media_type text,tmdb_id integer,
            metadata jsonb,inventory_tmdb_attempted_at timestamptz,inventory_tmdb_fetched_at timestamptz);
        CREATE TABLE sampler_race.task_queue(task_type text,status text,payload jsonb);
        CREATE TABLE sampler_race.tmdb_config(is_active boolean,api_key text);
        INSERT INTO sampler_race.library_observation_sampling_state(singleton) VALUES(true);
        INSERT INTO sampler_race.libraries VALUES(1,'Race',true),(2,'Next',true)`);
    const clients=await Promise.all([getPool().connect(),getPool().connect()]);
    try {
        await Promise.all(clients.map(client=>client.query('SET search_path=sampler_race,public')));
        const snapshots=await Promise.all(clients.map(client=>readLibraryObservationSamplingSnapshot(client)));
        const writes=await Promise.all(clients.map((client,index)=>persistLibraryObservationSample(client,snapshots[index])));
        expect(writes.map(write=>write.captured).sort()).toEqual([false,true]);
        expect((await clients[0].query('SELECT last_library_id FROM library_observation_sampling_state')).rows[0].last_library_id).toBe(1);
        expect((await clients[0].query('SELECT COUNT(*)::int n FROM library_observation_points')).rows[0].n).toBe(1);
    } finally {
        for(const client of clients) { await client.query('RESET search_path'); client.release(); }
        await getPool().query('DROP SCHEMA sampler_race CASCADE');
    }
});
