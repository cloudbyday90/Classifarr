/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { persistEnrichmentMetadata } from '../../services/queueEnrichmentPersistence.mjs';
import { captureLegacyObservationFixture as captureLibraryObservationSample } from '../helpers/captureLegacyObservationFixture.mjs';
import { readLibraryObservationHistory } from '../../services/libraryObservationHistory.mjs';
import { readInventoryTmdbObservation } from '../../services/inventoryTmdbObservation.mjs';
import { inventoryObservationValidityCases } from '../helpers/inventoryObservationValidityCases.mjs';

let db;
const source = { media_server_id: 1, external_id: 'fixture', library_id: 1, media_type: 'movie', title: 'PRIVATE',
    year: 2001, imdb_id: null, tvdb_id: null };
const payload = { itemId: 1, source_library_id: 1, media: { media_type: 'movie' }, source_identity_snapshot: source };
const observation = { version: 1, tmdb_id: 7, media_type: 'movie', keywords: [], original_language: null };
beforeEach(async () => {
    db = await getPool().connect();
    await db.query('BEGIN');
    await db.query(`CREATE TEMP TABLE inventory_observation_activity (LIKE public.inventory_observation_activity INCLUDING ALL) ON COMMIT DROP;
        CREATE TEMP TABLE library_observation_samples (LIKE public.library_observation_samples INCLUDING ALL) ON COMMIT DROP;
        CREATE TEMP TABLE libraries (id integer PRIMARY KEY, name text, is_active boolean) ON COMMIT DROP;
        CREATE TEMP TABLE media_server_items (id integer PRIMARY KEY, media_server_id integer, external_id text,
            library_id integer, media_type text, title text, year integer, imdb_id text, tvdb_id integer, tmdb_id integer,
            metadata jsonb, inventory_tmdb_attempted_at timestamptz, inventory_tmdb_fetched_at timestamptz) ON COMMIT DROP;
        CREATE TEMP TABLE task_queue (task_type text, status text, payload jsonb) ON COMMIT DROP;
        CREATE TEMP TABLE tmdb_config (is_active boolean, api_key text) ON COMMIT DROP;
        INSERT INTO libraries VALUES (1, 'PRIVATE LIBRARY', true);
        INSERT INTO tmdb_config VALUES (true, 'PRIVATE KEY');
        INSERT INTO media_server_items VALUES (1,1,'fixture',1,'movie','PRIVATE',2001,NULL,NULL,7,'{}',NULL,NULL);`);
});
afterEach(async () => { await db.query('ROLLBACK'); db.release(); });
const persist = (metadata = {}, attempted = true, input = payload) =>
    persistEnrichmentMetadata((sql, values) => db.query(sql, values), input, 7, metadata, attempted);
const history = () => readLibraryObservationHistory(db);

test('captured, unavailable and unchanged outcomes reflect guarded persistence, not task completion', async () => {
    expect((await persist({ inventory_tmdb: observation })).rowCount).toBe(1);
    await persist({}, true); await persist({}, false);
    const result = await history();
    expect(result.activity).toHaveLength(1);
    expect(result.activity[0]).toMatchObject({ attempted: 2, captured: 1, unavailable: 1 });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|fixture|tmdb_id|keywords|original_language/);
});

test('changed source rejects both metadata and outcome increments', async () => {
    await db.query("UPDATE media_server_items SET title = 'Changed'");
    expect((await persist({ inventory_tmdb: observation })).rowCount).toBe(0);
    expect((await history()).activity).toEqual([]);
    expect((await db.query('SELECT metadata FROM media_server_items')).rows[0].metadata).toEqual({});
});

test('counter failure rolls back the metadata update in the same statement', async () => {
    await db.query(`INSERT INTO inventory_observation_activity VALUES
        (mod(floor(extract(epoch FROM NOW())/3600)::bigint,168), date_trunc('hour',NOW(),'UTC'),9007199254740991,0)`);
    await db.query('SAVEPOINT overflow');
    await expect(persist({ inventory_tmdb: observation })).rejects.toThrow();
    await db.query('ROLLBACK TO SAVEPOINT overflow');
    expect((await db.query('SELECT metadata, inventory_tmdb_attempted_at FROM media_server_items')).rows[0])
        .toEqual({ metadata: {}, inventory_tmdb_attempted_at: null });
});

test('an old hourly slot resets counters and expired/future rows stay outside reads', async () => {
    await db.query(`INSERT INTO inventory_observation_activity VALUES
        (mod(floor(extract(epoch FROM NOW())/3600)::bigint,168), date_trunc('hour',NOW(),'UTC') - INTERVAL '168 hours',10,20)`);
    expect((await history()).activity).toEqual([]);
    await persist({ inventory_tmdb: observation });
    expect((await history()).activity[0]).toMatchObject({ captured: 1, unavailable: 0 });
    await db.query("UPDATE inventory_observation_activity SET bucket_at = bucket_at + INTERVAL '168 hours'");
    await persist();
    expect((await history()).activity).toEqual([]);
    expect((await db.query('SELECT captured,unavailable FROM inventory_observation_activity')).rows[0]).toEqual({ captured: 1, unavailable: 0 });
});

test('hourly coverage retains the first sample and distinguishes valid empty captures from known traits', async () => {
    await persist({ inventory_tmdb: observation });
    expect(await captureLibraryObservationSample(db)).toEqual({ captured: true });
    expect(await captureLibraryObservationSample(db)).toEqual({ captured: false });
    const result = await history();
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]).toMatchObject({ status: 'available', libraryIds: [1], inventoryRows: 1,
        identifiedRows: 1, capturedRows: 1, freshRows: 1, keywordRows: 0, languageRows: 0 });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    await db.query("UPDATE library_observation_samples SET observed_at = observed_at - INTERVAL '168 hours'");
    expect((await history()).samples).toEqual([]);
    expect(await captureLibraryObservationSample(db)).toEqual({ captured: true });
    expect((await db.query('SELECT COUNT(*)::int AS n FROM library_observation_samples')).rows[0].n).toBe(1);
});

test('capacity status withholds partial coverage counts rather than storing zeros', async () => {
    await db.query(`INSERT INTO media_server_items (id,library_id,media_type,tmdb_id,metadata)
        SELECT id,1,'movie',7,'{}' FROM generate_series(2,20001) id`);
    await captureLibraryObservationSample(db);
    expect((await history()).samples[0]).toMatchObject({ status: 'capacity_exceeded', libraryIds: [1],
        inventoryRows: null, identifiedRows: null, capturedRows: null, keywordRows: null });
});

test('projection preserves missing language as invalid while explicit null remains a valid empty capture', async () => {
    const { original_language: _omitted, ...missingLanguage } = observation;
    await db.query('UPDATE media_server_items SET metadata = $1, inventory_tmdb_fetched_at = NOW()',
        [JSON.stringify({ inventory_tmdb: missingLanguage })]);
    await captureLibraryObservationSample(db);
    expect((await history()).samples[0]).toMatchObject({ capturedRows: 0, freshRows: 0, keywordRows: 0 });
    const projected = (await db.query('SELECT library_profile_observed_metadata($1::jsonb) AS metadata',
        [JSON.stringify({ inventory_tmdb: missingLanguage })])).rows[0].metadata;
    expect(projected.inventory_tmdb).not.toHaveProperty('original_language');
    await db.query('DELETE FROM library_observation_samples');
    await persist({ inventory_tmdb: observation });
    await captureLibraryObservationSample(db);
    expect((await history()).samples[0]).toMatchObject({ capturedRows: 1, freshRows: 1, keywordRows: 0, languageRows: 0 });
});

test('storage stays at 168 activity slots and supports all valid empty hourly samples', async () => {
    await db.query(`INSERT INTO inventory_observation_activity
        SELECT mod(floor(extract(epoch FROM hour)/3600)::bigint,168),hour,0,1
        FROM generate_series(date_trunc('hour',NOW(),'UTC') - INTERVAL '167 hours', date_trunc('hour',NOW(),'UTC'), INTERVAL '1 hour') hour`);
    await persist();
    expect((await history()).activity).toHaveLength(168);
    await db.query('SAVEPOINT invalid_slot');
    await expect(db.query("INSERT INTO inventory_observation_activity VALUES (168,date_trunc('hour',NOW(),'UTC'),0,0)")).rejects.toThrow();
    await db.query('ROLLBACK TO SAVEPOINT invalid_slot');
    expect((await db.query('SELECT COUNT(*)::int AS n FROM inventory_observation_activity')).rows[0].n).toBe(168);
});

test('all 32 explicit validity expectations survive the shared SQL projection', async () => {
    const schema = await readFile(new URL('../../../../database/schema/current.sql', import.meta.url), 'utf8');
    const projection = schema.match(/CREATE FUNCTION public\.library_profile_observed_metadata\(payload jsonb\)[\s\S]+?\$\$;/)?.[0];
    expect(projection).toBeTruthy();
    await db.query(projection.replace('FUNCTION public.library_profile_observed_metadata', 'FUNCTION pg_temp.snapshot_observed_metadata'));
    for (const fixture of inventoryObservationValidityCases) {
        const { rows } = await db.query(`SELECT public.library_profile_observed_metadata($1::jsonb) AS metadata,
            pg_temp.snapshot_observed_metadata($1::jsonb) AS snapshot_metadata`,
            [JSON.stringify({ inventory_tmdb: fixture.record })]);
        expect(Boolean(readInventoryTmdbObservation({ media_type: 'movie', tmdb_id: 7, metadata: rows[0].metadata })))
            .toBe(fixture.reusable);
        expect(Boolean(readInventoryTmdbObservation({ media_type: 'movie', tmdb_id: 7, metadata: rows[0].snapshot_metadata })))
            .toBe(fixture.reusable);
    }
});
