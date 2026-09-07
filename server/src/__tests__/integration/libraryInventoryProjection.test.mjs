/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { setupObservationScanTables } from './helpers/setupObservationScanTables.mjs';
import { inventoryObservationValidityCases } from '../helpers/inventoryObservationValidityCases.mjs';
import { readLibraryObservationHealthSnapshot } from '../../services/libraryObservationHealthQuery.mjs';
import { readLibraryObservationSamplingSnapshot } from '../../services/libraryObservationSamplingQuery.mjs';
import { readLibraryOverlapSnapshot } from '../../services/libraryOverlapQuery.mjs';
import { readLibraryObservationHealth } from '../../services/libraryObservationHealthService.mjs';

let db;
const readers = [
    ['health', readLibraryObservationHealthSnapshot],
    ['sampling', readLibraryObservationSamplingSnapshot],
    ['overlap', readLibraryOverlapSnapshot],
];
beforeEach(async () => {
    db = await getPool().connect();
    await db.query('BEGIN');
    await setupObservationScanTables(db);
    await db.query(`ALTER TABLE media_server_items ADD content_rating text, ADD studio text, ADD genres text[];
        ALTER TABLE media_server_items ALTER COLUMN metadata SET STORAGE EXTERNAL;
        UPDATE libraries SET name = 'Fixture library';
        DELETE FROM media_server_items WHERE id = 2`);
});
afterEach(async () => { await db.query('ROLLBACK'); db.release(); });

async function setMetadata(value) {
    // undefined represents SQL NULL; null represents the distinct JSON null value.
    await db.query(`UPDATE media_server_items SET metadata = $1,
        inventory_tmdb_fetched_at = transaction_timestamp() WHERE id = 1`,
    [value === undefined ? null : JSON.stringify(value)]);
}

async function assertCanonicalSnapshots() {
    // Independent full-input reference: preserve every field, null and byte-limit decision.
    const reference = (await db.query(`WITH projected AS MATERIALIZED (
        SELECT public.library_profile_observed_metadata(metadata) AS metadata,
            COALESCE(metadata ? 'inventory_tmdb', false) AS has_observation
        FROM media_server_items WHERE id = 1
    ) SELECT metadata, has_observation, octet_length(metadata::text) AS metadata_bytes,
        octet_length((metadata -> 'inventory_tmdb')::text) AS observation_bytes FROM projected`)).rows[0];
    const snapshots = {};
    for (const [name, reader] of readers) {
        const snapshot = await reader(db);
        expect(snapshot.items).toHaveLength(1);
        const row = snapshot.items[0];
        if (name === 'overlap') {
            const withheld = reference.metadata_bytes > 4096;
            expect(row.metadata).toEqual(withheld ? null : reference.metadata);
            expect(row.omitted_traits).toBe(withheld);
        } else {
            const withheld = reference.observation_bytes > 4096;
            expect(row.metadata).toEqual({ inventory_tmdb: withheld ? null : reference.metadata.inventory_tmdb });
            expect(row.has_observation).toBe(reference.has_observation);
            expect(row.observation_withheld).toBe(withheld);
        }
        snapshots[name] = snapshot;
    }
    expect(snapshots.sampling.population_fingerprints['1']).toBe(snapshots.health.population_fingerprints['1']);
    expect(snapshots.health.population_fingerprints['1']).toMatch(/^[a-f0-9]{64}$/);
    return snapshots;
}

describe('inventory read projection equivalence in PostgreSQL', () => {
    test.each(inventoryObservationValidityCases)('preserves attributable validation: $name', async ({ record, reusable }) => {
        await setMetadata({ inventory_tmdb: record, secret: 'PRIVATE' });
        const snapshots = await assertCanonicalSnapshots();
        const report = await readLibraryObservationHealth({ query: async () => ({ rows: [snapshots.health] }) });
        expect(report.libraries[0].counts.captured).toBe(reusable ? 1 : 0);
        expect(JSON.stringify(snapshots)).not.toContain('PRIVATE');
    });

    test.each([
        ['SQL null', undefined], ['JSON null', null], ['empty object', {}],
        ['string root', 'inventory_tmdb'], ['boolean root', true], ['number root', 7],
        ['array root', ['inventory_tmdb', { inventory_tmdb: {} }]],
        ['array section', { inventory_tmdb: [], omdb: [], tmdb: [] }],
        ['scalar sections', { inventory_tmdb: 7, omdb: true, tmdb: 'PRIVATE' }],
        ['null sections', { inventory_tmdb: null, omdb: null, tmdb: null }],
    ])('preserves malformed input and source presence: %s', async (_name, metadata) => {
        await setMetadata(metadata);
        await assertCanonicalSnapshots();
    });

    test('discards large unrelated TOAST fields before byte limits without losing provider fallbacks', async () => {
        const privateValue = 'PRIVATE'.repeat(10000);
        await setMetadata({ secret: privateValue,
            inventory_tmdb: { version: 1, tmdb_id: 7, media_type: 'movie', keywords: ['space'],
                original_language: null, overview: privateValue },
            tmdb: { genres: [{ name: 'Drama' }], certification: 'PG', production_companies: [{ name: 'Studio' }],
                original_language: 'fr', overview: privateValue },
            omdb: { rated: 'G', data: { rated: 'PG', plot: privateValue }, plot: privateValue } });
        const snapshots = await assertCanonicalSnapshots();
        expect(snapshots.health.items[0]).toMatchObject({ observation_withheld: false,
            metadata: { inventory_tmdb: { original_language: null, keywords: ['space'] } } });
        expect(snapshots.overlap.items[0]).toMatchObject({ omitted_traits: false,
            metadata: { tmdb: { genres: [{ name: 'Drama' }], certification: 'PG', production_companies: [{ name: 'Studio' }] },
                omdb: { rated: 'G', data: { rated: 'PG' } } } });
        expect(JSON.stringify(snapshots)).not.toMatch(/PRIVATE|overview|plot|original_language":"fr/);
    });

    describe.each(readers)('%s byte boundary', (name, reader) => {
        test.each([4096, 4097])('uses projected UTF-8 bytes at %i bytes', async targetBytes => {
            const record = { version: 1, tmdb_id: 7, media_type: 'movie', keywords: ['é'], original_language: null };
            await setMetadata({ inventory_tmdb: record });
            const reference = (await db.query(`SELECT
                octet_length(public.library_profile_observed_metadata(metadata)::text) AS metadata_bytes,
                octet_length((public.library_profile_observed_metadata(metadata) -> 'inventory_tmdb')::text) AS observation_bytes
                FROM media_server_items WHERE id = 1`)).rows[0];
            record.keywords[0] += 'x'.repeat(targetBytes - reference[name === 'overlap' ? 'metadata_bytes' : 'observation_bytes']);
            await setMetadata({ inventory_tmdb: record, secret: 'PRIVATE'.repeat(10000) });
            const snapshots = await assertCanonicalSnapshots();
            const row = snapshots[name].items[0];
            expect(name === 'overlap' ? row.omitted_traits : row.observation_withheld).toBe(targetBytes > 4096);
            if (targetBytes === 4096) expect(row.metadata.inventory_tmdb.keywords).toEqual(record.keywords);
            // Exercise the actual reader in a read-only transaction as well.
            await db.query('SET TRANSACTION READ ONLY');
            expect((await reader(db)).items).toEqual(snapshots[name].items);
        });
    });
});
