/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createLibraryProfileService } from '../../services/libraryProfileService.mjs';
import { readLibraryProfileObservation } from '../../services/libraryProfileQueries.mjs';

const db = createIntegrationDatabaseModuleMock();
const service = createLibraryProfileService({ dbClient: db });
let libraryId;
beforeEach(async () => {
    libraryId = (await db.query("INSERT INTO libraries (name, external_id, media_type) VALUES ('Observation fixture', $1, 'movie') RETURNING id", [randomUUID()])).rows[0].id;
});
afterEach(async () => {
    await db.query('DELETE FROM media_server_items WHERE library_id = $1', [libraryId]);
    await db.query('DELETE FROM libraries WHERE id = $1', [libraryId]);
});
async function add({ genres = [], rating = null, metadata = {}, mediaType = 'movie', tmdbId = null } = {}) {
    return db.query(`INSERT INTO media_server_items (external_id, title, library_id, media_type, genres, content_rating, metadata, tmdb_id)
        VALUES ($1, 'Fixture only', $2, $3, $4, $5, $6, $7)`, [randomUUID(), libraryId, mediaType, genres, rating, metadata, tmdbId]);
}

describe('shared library observations in PostgreSQL', () => {
    test('stored and live projections agree on item prevalence and exact coverage', async () => {
        await add({ genres: ['Action', 'Drama', 'Action'], rating: 'PG', tmdbId: 7 });
        await add({ genres: ['Action'], mediaType: 'tv', rating: '16', tmdbId: 7 });
        await add({ tmdbId: 7 });
        const generated = await service.generateProfile(libraryId);
        const stored = await service.getProfile(libraryId);
        const live = await service.getProfileStats(libraryId);
        expect(stored.genre_distribution).toEqual({ Action: 66.7, Drama: 33.3 });
        expect(live.genreDistribution).toEqual([{ genre: 'Action', count: 2, percentage: 66.7 }, { genre: 'Drama', count: 1, percentage: 33.3 }]);
        expect(stored.observation_summary).toEqual(generated.observation);
        expect(live.observation.traits.genres).toEqual({ observedCount: 2, unknownCount: 1 });
        expect(stored.observation_summary).toMatchObject({ distinctTypedIdentityCount: 2, duplicateIdentifiedRowCount: 1 });
        expect(stored.exclusion_ratings).toEqual([]);
        expect(stored.rating_distribution).toEqual({ PG: 33.3, 'TV-MA': 33.3 });
    });
    test('uses provider fallbacks without copying titles, plots or credentials', async () => {
        await add({ rating: 'Unknown', metadata: { password: 'omit', title: 'omit', omdb: { data: { rated: null }, rated: 'PG' }, tmdb: {
            genres: [{ name: 'Drama' }], original_language: 'EN', overview: 'omit', keywords: { keywords: [{ name: 'space' }] },
            production_companies: [{ name: 'Example' }],
        } } });
        const { observation, stats } = await readLibraryProfileObservation(db, libraryId);
        expect(stats.certificationDistribution).toEqual([{ certification: 'PG', count: 1, percentage: 100 }]);
        expect(observation.traits.keywords.entries[0].value).toBe('space');
        expect(JSON.stringify(observation)).not.toContain('omit');
        expect(JSON.stringify(stats.observation)).not.toContain('space');
    });
    test('live observation is read-only and a database failure stays unavailable', async () => {
        await add({ genres: ['Drama'] });
        const client = await getPool().connect();
        try {
            await client.query('BEGIN READ ONLY');
            expect((await readLibraryProfileObservation(client, libraryId)).stats.totalItems).toBe(1);
            await client.query('COMMIT');
        } finally { await client.query('ROLLBACK'); client.release(); }
        const broken = { query: () => Promise.reject(new Error('unavailable')) };
        await expect(readLibraryProfileObservation(broken, libraryId)).rejects.toThrow('unavailable');
        expect((await db.query('SELECT * FROM library_profiles WHERE library_id = $1', [libraryId])).rows).toEqual([]);
    });
    test('bulk regeneration removes a previously populated empty profile', async () => {
        await add({ genres: ['Drama'] });
        await service.generateProfile(libraryId);
        await db.query('DELETE FROM media_server_items WHERE library_id = $1', [libraryId]);
        const results = await service.generateAllProfiles();
        expect(results.find(row => row.id === libraryId)).toMatchObject({ success: true, profile: null });
        expect(await service.getProfile(libraryId)).toBeNull();
    });
    test.each([false, true])('does not restore an older observation after a newer refresh (empty=%s)', async empty => {
        await add({ genres: ['Drama'] });
        let finishOld;
        let signalRead;
        const readStarted = new Promise(resolve => { signalRead = resolve; });
        const older = createLibraryProfileService({ dbClient: { query: async (sql, values) => {
            const result = await db.query(sql, values);
            if (sql.startsWith('SELECT msi.tmdb_id')) {
                signalRead();
                await new Promise(resolve => { finishOld = resolve; });
            }
            return result;
        } } }).generateProfile(libraryId);
        await readStarted;
        if (empty) await db.query('DELETE FROM media_server_items WHERE library_id = $1', [libraryId]);
        else await add({ genres: ['Action'] });
        await service.generateProfile(libraryId);
        finishOld();
        await older;
        const stored = await service.getProfile(libraryId);
        if (empty) expect(stored).toBeNull();
        else expect(stored.item_count).toBe(2);
    });
});
