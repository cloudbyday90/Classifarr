/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { captureLegacyObservationFixture as captureLibraryObservationSample } from '../helpers/captureLegacyObservationFixture.mjs';
import { readLibraryObservationHistory } from '../../services/libraryObservationHistory.mjs';
import { readLibraryObservationHealthSnapshot } from '../../services/libraryObservationHealthQuery.mjs';

let db;
beforeEach(async () => {
    db = await getPool().connect();
    await db.query('BEGIN');
    await db.query(`CREATE TEMP TABLE library_observation_samples (LIKE public.library_observation_samples INCLUDING ALL) ON COMMIT DROP;
        CREATE TEMP TABLE inventory_observation_activity (LIKE public.inventory_observation_activity INCLUDING ALL) ON COMMIT DROP;
        CREATE TEMP TABLE libraries (id integer PRIMARY KEY, name text, is_active boolean) ON COMMIT DROP;
        CREATE TEMP TABLE media_server_items (id integer PRIMARY KEY, library_id integer, media_type text, tmdb_id integer,
            metadata jsonb, inventory_tmdb_attempted_at timestamptz, inventory_tmdb_fetched_at timestamptz) ON COMMIT DROP;
        CREATE TEMP TABLE task_queue (task_type text, status text, payload jsonb) ON COMMIT DROP;
        CREATE TEMP TABLE tmdb_config (is_active boolean, api_key text) ON COMMIT DROP;
        INSERT INTO libraries VALUES (1,'PRIVATE',true),(2,'PRIVATE',true);
        INSERT INTO media_server_items VALUES (1,1,'movie',7,'{}',NULL,NULL),(2,2,'tv',8,'{}',NULL,NULL);
        INSERT INTO tmdb_config VALUES (true,'PRIVATE')`);
});
afterEach(async () => { await db.query('ROLLBACK'); db.release(); });
const capture = (hoursAgo = 0) => captureLibraryObservationSample({ query: (sql, values) =>
    db.query(sql.replaceAll('statement_timestamp()', `(statement_timestamp() - INTERVAL '${hoursAgo} hours')`), values) });
const history = () => readLibraryObservationHistory(db);
const fingerprints = async () => (await readLibraryObservationHealthSnapshot(db)).population_fingerprints;

test('real SQL separates per-library gains and unchanged intervals, then breaks equal-count identity comparisons', async () => {
    await capture(2);
    await db.query(`UPDATE media_server_items SET metadata = '{"inventory_tmdb":{"version":1,"media_type":"movie",
        "tmdb_id":7,"keywords":["space"],"original_language":"en"}}', inventory_tmdb_fetched_at = NOW() - INTERVAL '1 day' WHERE id=1`);
    await capture(1);
    let result = await history();
    expect(result.samples[0].libraryCoverage[0]).toMatchObject({ comparison: 'comparable',
        delta: { capturedRows: 1, freshRows: 1, keywordRows: 1, languageRows: 1 } });
    await db.query('UPDATE media_server_items SET tmdb_id=9 WHERE id=1');
    await capture();
    result = await history();
    expect(result.samples[0].libraryCoverage[0]).toMatchObject({ inventoryRows: 1, comparison: 'population_changed', delta: null });
    expect(result.samples[0].libraryCoverage[1]).toMatchObject({ comparison: 'comparable', unchangedIntervals: 2 });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|populationFingerprint|space|tmdb_id/);
});

test.each(['UPDATE media_server_items SET id=3 WHERE id=1',
    "UPDATE media_server_items SET media_type='tv' WHERE id=1",
    'UPDATE media_server_items SET tmdb_id=NULL WHERE id=1',
    'UPDATE media_server_items SET library_id=2 WHERE id=1'])('membership fingerprint detects: %s', async sql => {
    const before = await fingerprints(); await db.query(sql);
    expect((await fingerprints())[1]).not.toBe(before[1]);
});

test('fingerprints ignore insertion order, unrelated metadata and library names', async () => {
    await db.query("INSERT INTO media_server_items VALUES(3,1,'movie',10,'{}',NULL,NULL)");
    const before = await fingerprints();
    await db.query(`WITH removed AS (DELETE FROM media_server_items RETURNING *)
        INSERT INTO media_server_items SELECT * FROM removed ORDER BY id DESC`);
    await db.query("UPDATE media_server_items SET metadata = '{\"private\":\"changed\"}'; UPDATE libraries SET name='Renamed'");
    expect(await fingerprints()).toEqual(before);
});

test('selection changes do not invalidate an unchanged library; missing hours and configuration do', async () => {
    await capture(4);
    await db.query("UPDATE libraries SET is_active=false WHERE id=2; INSERT INTO libraries VALUES(3,'New',true)");
    await capture(3);
    let frame = (await history()).samples[0];
    expect(frame.selectionChanged).toBe(true);
    expect(frame.libraryCoverage.map(row => row.comparison)).toEqual(['comparable', 'newly_selected']);
    await capture(1);
    expect((await history()).samples[0].libraryCoverage[0].comparison).toBe('sample_gap');
    await db.query('UPDATE tmdb_config SET is_active=false'); await capture();
    expect((await history()).samples[0].libraryCoverage[0].comparison).toBe('configuration_changed');
});

test('capacity withholds fingerprints and details, and legacy or malformed frames stay unknown', async () => {
    await capture(2);
    await db.query('UPDATE library_observation_samples SET library_coverage_v1=NULL');
    await capture(1);
    expect((await history()).samples[0].libraryCoverage[0].comparison).toBe('previous_unavailable');
    await db.query(`UPDATE library_observation_samples SET library_coverage_v1='[{},{}]'`);
    expect((await history()).samples.every(frame => frame.libraryCoverage === null)).toBe(true);
    await db.query(`INSERT INTO media_server_items (id,library_id,media_type,tmdb_id,metadata)
        SELECT id,1,'movie',7,'{}' FROM generate_series(3,20001) id`);
    expect(await fingerprints()).toEqual({}); await capture();
    expect((await history()).samples[0]).toMatchObject({ status: 'capacity_exceeded', libraryCoverage: null });
});

test('database bounds detail bytes, entry count and type; a failed replacement preserves the whole frame', async () => {
    await capture();
    for (const bad of [{}, Array(13).fill({}), [{ padding: 'x'.repeat(17000) }, {}]]) {
        await db.query('SAVEPOINT bad_detail');
        await expect(db.query('UPDATE library_observation_samples SET library_coverage_v1=$1::jsonb', [JSON.stringify(bad)])).rejects.toThrow();
        await db.query('ROLLBACK TO SAVEPOINT bad_detail');
        expect((await history()).samples[0].libraryCoverage).toHaveLength(2);
    }
});

test('168 slots retain at most 2016 library points and same-hour attempts keep one atomic frame', async () => {
    await db.query("INSERT INTO libraries SELECT id,'Library',true FROM generate_series(3,13) id");
    expect(await Promise.all([capture(), capture()])).toEqual(expect.arrayContaining([{ captured: true }, { captured: false }]));
    const first = (await history()).samples[0];
    expect(first.excludedLibraryCount).toBe(1); expect(first.libraryCoverage).toHaveLength(12);
    await db.query(`INSERT INTO library_observation_samples SELECT
        mod(floor(extract(epoch FROM observed_at - offset_hours * INTERVAL '1 hour') / 3600)::bigint,168),
        observed_at - offset_hours * INTERVAL '1 hour',status,library_ids,excluded_library_count,acquisition_configured,
        inventory_rows,supported_rows,identified_rows,captured_rows,fresh_rows,keyword_rows,language_rows,library_coverage_v1
        FROM library_observation_samples CROSS JOIN generate_series(1,167) offset_hours`);
    const result = await history();
    expect(result.samples).toHaveLength(168);
    expect(result.samples.reduce((count, frame) => count + frame.libraryCoverage.length, 0)).toBe(2016);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(1500000);
    await db.query("UPDATE library_observation_samples SET observed_at=observed_at-INTERVAL '168 hours'");
    await capture();
    expect((await db.query('SELECT COUNT(*)::int AS n FROM library_observation_samples')).rows[0].n).toBe(168);
    expect((await history()).samples).toHaveLength(1);
});
