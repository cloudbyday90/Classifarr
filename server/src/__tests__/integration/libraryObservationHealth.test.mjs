/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { readLibraryObservationHealth } from '../../services/libraryObservationHealthService.mjs';

let client;
beforeEach(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');
    await client.query(`CREATE TEMP TABLE libraries (id integer PRIMARY KEY, name text, is_active boolean) ON COMMIT DROP;
        CREATE TEMP TABLE media_server_items (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            library_id integer, media_type text, tmdb_id integer, metadata jsonb,
            inventory_tmdb_attempted_at timestamptz, inventory_tmdb_fetched_at timestamptz) ON COMMIT DROP;
        CREATE TEMP TABLE task_queue (task_type text, status text, payload jsonb) ON COMMIT DROP;
        CREATE TEMP TABLE tmdb_config (is_active boolean, api_key text) ON COMMIT DROP;
        INSERT INTO libraries VALUES (1, 'First', true), (2, 'Empty', true), (3, 'Inactive', false)`);
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
const observation = (extra = {}) => ({ version: 1, tmdb_id: 7, media_type: 'movie', keywords: ['space'], original_language: 'en', ...extra });
async function add({ library = 1, type = 'movie', id = 7, record = null, attempted = null, fetched = null } = {}) {
    return (await client.query(`INSERT INTO media_server_items (library_id, media_type, tmdb_id, metadata,
        inventory_tmdb_attempted_at, inventory_tmdb_fetched_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [library, type, id, record ? { inventory_tmdb: record, secret: 'PRIVATE' } : {}, attempted, fetched])).rows[0].id;
}
async function task(id, status = 'pending', type = 'metadata_enrichment', key = 'itemId') {
    await client.query('INSERT INTO task_queue VALUES ($1, $2, $3)', [type, status, { [key]: id }]);
}

describe('library observation health PostgreSQL snapshot', () => {
    test('uses real typed provenance, source-row coverage and empty/inactive library semantics', async () => {
        const recent = new Date().toISOString();
        await add({ record: observation(), fetched: recent, attempted: recent });
        await add({ record: observation({ keywords: [], original_language: null }), fetched: recent });
        await add({ id: null }); await add({ type: 'tv', record: observation(), fetched: recent }); await add({ library: 3 });
        const report = await readLibraryObservationHealth(client);
        expect(report.inventoryRowCount).toBe(4);
        expect(report.libraries.map(library => library.id)).toEqual([1, 2]);
        expect(report.libraries[0]).toMatchObject({ identifiedRowCount: 3, keywordCoveragePercent: 33.3,
            languageCoveragePercent: 33.3, counts: { captured: 2, emptyKeywords: 1, unknownLanguage: 1, invalidObservation: 1 },
            states: { fresh: 2, missing_identity: 1, due: 1 } });
        expect(report.libraries[1]).toMatchObject({ inventoryRowCount: 0, lastSuccessfulObservationAt: null });
        expect(JSON.stringify(report)).not.toMatch(/PRIVATE|space|api_key|tmdb_id/);
    });
    test('counts current item-linked active tasks once, with processing precedence and safe payload matching', async () => {
        const id = await add();
        const other = await add();
        await task(id); await task(String(id)); await task(id, 'processing');
        await task(other, 'pending', 'classification'); await task(other, 'failed');
        await task(other, 'pending', 'metadata_enrichment', 'media_item_id');
        await task('999999999999999999999999999999999'); await task('7x'); await task({ nested: 'value' });
        const result = (await readLibraryObservationHealth(client)).libraries[0];
        expect(result.queue).toEqual({ processing: 1, pending: 0, idle: 1 });
        expect(result.states.never_observed).toBe(2);
    });
    test.each([[false, 'private', false], [true, '   ', false], [true, null, false], [true, 'private', true]])('only exposes configuration presence (%s, %s)', async (active, key, expected) => {
        await client.query('INSERT INTO tmdb_config VALUES ($1, $2)', [active, key]);
        const result = await readLibraryObservationHealth(client);
        expect(result.acquisitionConfigured).toBe(expected);
        expect(JSON.stringify(result)).not.toContain('private');
    });
    test('distinguishes a failed refresh cooldown, expired capture and future/infinite clocks', async () => {
        await add({ record: observation(), fetched: '2020-01-01Z', attempted: new Date().toISOString() });
        await add({ record: observation(), fetched: '2020-01-01Z' });
        await add({ record: observation(), fetched: 'infinity' });
        await add({ attempted: '2099-01-01Z' });
        const report = await readLibraryObservationHealth(client);
        expect(report.libraries[0]).toMatchObject({ states: { backoff: 1, due: 1, clock_anomaly: 2 },
            counts: { attemptWithoutRefresh: 1 }, lastSuccessfulObservationAt: '2020-01-01T00:00:00.000Z' });
    });
    test('withholds oversized observations without inventing fresh coverage', async () => {
        await add({ record: observation({ keywords: Array(100).fill('word'.repeat(20)) }), fetched: new Date().toISOString() });
        const library = (await readLibraryObservationHealth(client)).libraries[0];
        expect(library.states.observation_withheld).toBe(1);
        expect(library.counts.captured).toBe(0);
        expect(library.lastSuccessfulObservationAt).toBeNull();
    });
    test('works read-only, including queue and provider-configuration inspection', async () => {
        await add();
        await client.query('SET TRANSACTION READ ONLY');
        expect((await readLibraryObservationHealth(client)).inventoryRowCount).toBe(1);
    });
    test('bounds libraries deterministically and withholds every sampled count beyond the row budget', async () => {
        await client.query("INSERT INTO libraries SELECT id, 'Extra', true FROM generate_series(4, 16) id");
        let report = await readLibraryObservationHealth(client);
        expect(report.scope).toMatchObject({ selectedLibraryCount: 12, activeLibraryCount: 15, excludedLibraryCount: 3 });
        expect(report.libraries.map(library => library.id)).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
        await client.query("INSERT INTO media_server_items (library_id, media_type, tmdb_id) SELECT 1, 'movie', id FROM generate_series(1, 20000) id");
        expect((await readLibraryObservationHealth(client)).inventoryRowCount).toBe(20000);
        await add();
        report = await readLibraryObservationHealth(client);
        expect(report).toMatchObject({ status: 'capacity_exceeded', inventoryRowCount: null, inventoryRowCountLowerBound: 20001 });
        expect(report.libraries[0]).not.toHaveProperty('counts');
    });
    test('an empty active population is explicitly empty', async () => {
        await client.query('UPDATE libraries SET is_active = false');
        expect(await readLibraryObservationHealth(client)).toMatchObject({ inventoryRowCount: 0, libraries: [] });
    });
});
