/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { readLibraryOverlap } from '../../services/libraryOverlapService.mjs';

let client;
beforeEach(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');
    // Private tables test the real query/function without touching shared fixture state.
    await client.query(`CREATE TEMP TABLE libraries (id integer PRIMARY KEY, name text, is_active boolean) ON COMMIT DROP;
        CREATE TEMP TABLE media_server_items (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            library_id integer, media_type text, tmdb_id integer, content_rating text, studio text,
            genres text[], metadata jsonb) ON COMMIT DROP;
        INSERT INTO libraries VALUES (1, 'First', true), (2, 'Second', true), (3, 'Empty', true), (4, 'Inactive', false)`);
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
async function add(libraryId, tmdbId, mediaType = 'movie', genres = [], metadata = {}) {
    await client.query(`INSERT INTO media_server_items (library_id, tmdb_id, media_type, genres, metadata)
        VALUES ($1, $2, $3, $4, $5)`, [libraryId, tmdbId, mediaType, genres, metadata]);
}

describe('bounded library overlap PostgreSQL snapshot', () => {
    test('reads deduplicated movie/TV overlap with empty and inactive libraries handled explicitly', async () => {
        await add(1, 7, 'movie', ['Drama']); await add(1, 7, 'movie', ['Drama']); await add(1, 8);
        await add(1, 7, 'tv'); await add(1, null); await add(2, 7, 'movie', ['Drama']);
        await add(2, 7, 'tv'); await add(4, 999);
        const result = await readLibraryOverlap(client);
        expect(result).toMatchObject({ inventoryRowCount: 7, status: 'available', scope: { activeLibraryCount: 3 } });
        expect(result.libraries.map(library => library.id)).toEqual([1, 2, 3]);
        expect(result.libraries[2]).toMatchObject({ inventoryRowCount: 0 });
        expect(result.pairs).toHaveLength(2);
        expect(result.pairs[0]).toMatchObject({ mediaType: 'movie', sharedIdentityCount: 1, leftOverlapPercent: 50,
            rightOverlapPercent: 100, identityStatus: 'partial_coverage' });
        expect(result.pairs[0].traits.find(trait => trait.field === 'genres')).toMatchObject({
            leftObservedIdentityCount: 1, rightObservedIdentityCount: 1, entries: [{ value: 'Drama', leftCount: 1, rightCount: 1,
                leftPercentOfIdentities: 50, rightPercentOfIdentities: 100 }] });
    });
    test('works in a read-only transaction and never generates profiles', async () => {
        await add(1, 7);
        await client.query('SET TRANSACTION READ ONLY');
        const result = await readLibraryOverlap(client);
        expect(result.inventoryRowCount).toBe(1);
        expect(result.observedAt).toBeTruthy();
    });
    test('uses current trait projection and requires attributable keyword/language identities', async () => {
        await add(1, 7, 'movie', [], { inventory_tmdb: { version: 1, tmdb_id: 7, media_type: 'movie',
            keywords: ['space'], original_language: 'en' }, secret: 'PRIVATE', tmdb: { genres: [{ name: 'Drama' }] } });
        await add(2, 8, 'movie', ['Drama'], { inventory_tmdb: { version: 1, tmdb_id: 8, media_type: 'movie',
            keywords: ['space'], original_language: 'en' }, tmdb: { original_language: 'fr' } });
        const result = await readLibraryOverlap(client);
        expect(result.pairs[0].traits.find(trait => trait.field === 'keywords').entries[0].value).toBe('space');
        expect(result.pairs[0].traits.find(trait => trait.field === 'language').entries[0].value).toBe('en');
        expect(JSON.stringify(result)).not.toContain('PRIVATE');
    });
    test('selects libraries by stable ID order and reports the omitted active population', async () => {
        await client.query("INSERT INTO libraries SELECT id, 'Extra', true FROM generate_series(5, 18) id");
        const result = await readLibraryOverlap(client);
        expect(result.scope).toMatchObject({ selectedLibraryCount: 12, excludedLibraryCount: 5, activeLibraryCount: 17 });
        expect(result.libraries.map(library => library.id)).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    });
    test('20,000 rows remain exact; one extra row withholds the entire selected comparison', async () => {
        await client.query(`INSERT INTO media_server_items (library_id, tmdb_id, media_type)
            SELECT CASE WHEN id % 2 = 0 THEN 1 ELSE 2 END, id, 'movie' FROM generate_series(1, 20000) id`);
        expect((await readLibraryOverlap(client)).inventoryRowCount).toBe(20000);
        await add(1, 20001);
        const result = await readLibraryOverlap(client);
        expect(result).toMatchObject({ status: 'capacity_exceeded', inventoryRowCount: null, inventoryRowCountLowerBound: 20001, pairs: [] });
        expect(result.libraries[0]).not.toHaveProperty('cohorts');
    });
    test('withholds oversized fields and counts omission without losing bounded core observations', async () => {
        await add(1, 7, 'movie', Array(400).fill('Oversized genre'), { tmdb: { genres: Array(1000).fill({ name: 'Oversized' }) } });
        await client.query("UPDATE media_server_items SET content_rating = 'PG', studio = 'Example'");
        const result = await readLibraryOverlap(client);
        expect(result.libraries[0].omittedTraitRowCount).toBe(1);
        const traits = result.libraries[0].cohorts[0].traits;
        expect(traits.find(trait => trait.field === 'genres').observedIdentityCount).toBe(0);
        expect(traits.find(trait => trait.field === 'rating').observedIdentityCount).toBe(1);
        expect(traits.find(trait => trait.field === 'studio').observedIdentityCount).toBe(1);
        expect(JSON.stringify(result)).not.toContain('Oversized');
    });
    test('returns a measured empty inventory when there are no active libraries', async () => {
        await client.query('UPDATE libraries SET is_active = false');
        expect(await readLibraryOverlap(client)).toMatchObject({ status: 'available', inventoryRowCount: 0, libraries: [], pairs: [] });
    });
});
