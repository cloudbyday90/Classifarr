/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createLibraryProfileService } from '../../services/libraryProfileService.mjs';
import { LibraryInventoryProfileRefreshPlanner } from '../../services/libraryInventoryProfileRefreshPlanner.mjs';
import { PolicyProfileRefreshOutboxWorker } from '../../services/policyProfileRefreshOutboxWorker.mjs';
import { policyProfileRefreshOutboxWorkerRepository as claims } from '../../services/policyProfileRefreshOutboxWorkerRepository.mjs';
import { compactInventoryProfileRefreshes } from '../../services/libraryInventoryProfileRefreshRepository.mjs';

const db = createIntegrationDatabaseModuleMock();
const profiles = createLibraryProfileService({ dbClient: db });
const planner = new LibraryInventoryProfileRefreshPlanner({ dbClient: db });
let libraryIds;
beforeEach(async () => {
    libraryIds = [];
    for (let i = 0; i < 2; i++) {
        const result = await db.query("INSERT INTO libraries (name, external_id, media_type) VALUES ($1, $2, 'movie') RETURNING id", [`Inventory fixture ${randomUUID()}`, randomUUID()]);
        libraryIds.push(result.rows[0].id);
    }
});
afterEach(async () => {
    await db.query('DELETE FROM media_server_items WHERE library_id = ANY($1::bigint[])', [libraryIds]);
    await db.query('DELETE FROM policy_profile_refresh_outbox WHERE library_id = ANY($1::bigint[])', [libraryIds]);
    await db.query('DELETE FROM libraries WHERE id = ANY($1::bigint[])', [libraryIds]);
});
async function add(libraryId = libraryIds[0]) {
    return db.query(`INSERT INTO media_server_items (external_id, title, library_id, media_type, genres, metadata)
        VALUES ($1, 'Fixture only', $2, 'movie', ARRAY['Action'], '{}') RETURNING id`, [randomUUID(), libraryId]);
}
async function state(libraryId = libraryIds[0]) {
    return (await db.query('SELECT revision::text, refreshed_revision::text FROM library_profile_inventory_state WHERE library_id = $1', [libraryId])).rows[0];
}
function worker(profileService = profiles, extra = {}) {
    return new PolicyProfileRefreshOutboxWorker({ dbClient: db, profileService,
        nativeCircuitRepository: { clearForLibrary: async () => 0 }, loggerInstance: { info() {}, warn() {} }, ...extra });
}

describe('inventory-driven profile refresh in PostgreSQL', () => {
    test('bumps once per bulk statement and ignores unchanged syncs and unrelated metadata', async () => {
        await db.query(`INSERT INTO media_server_items (external_id, title, library_id, media_type, genres, metadata)
            SELECT gen_random_uuid()::text, 'Fixture only', $1, 'movie', ARRAY['Action'], '{"tmdb":{"genres":[]}}'::jsonb
            FROM generate_series(1, 3)`, [libraryIds[0]]);
        expect((await state()).revision).toBe('1');
        await db.query(`UPDATE media_server_items SET last_synced = NOW(), genres = genres,
            metadata = metadata || '{"summary":"changed"}'::jsonb WHERE library_id = $1`, [libraryIds[0]]);
        await db.query(`UPDATE media_server_items SET metadata = jsonb_set(metadata, '{tmdb,overview}', '"changed"') WHERE library_id = $1`, [libraryIds[0]]);
        expect((await state()).revision).toBe('1');
        await db.query("UPDATE media_server_items SET genres = ARRAY['Drama'] WHERE library_id = $1", [libraryIds[0]]);
        expect((await state()).revision).toBe('2');
    });
    test('unchanged upserts do not enqueue new observation work', async () => {
        const { rows: [item] } = await add();
        await planner.run();
        await worker().run();
        await db.query(`INSERT INTO media_server_items (id, external_id, title, library_id, media_type)
            VALUES ($1, $2, 'Fixture only', $3, 'movie') ON CONFLICT (id) DO UPDATE SET last_synced = NOW()`, [item.id, randomUUID(), libraryIds[0]]);
        expect(await state()).toMatchObject({ revision: '1', refreshed_revision: '1' });
        expect((await planner.run()).queued).toBe(0);
    });
    test('truncate marks prior inventories dirty and rolls back atomically', async () => {
        await add();
        await planner.run();
        await worker().run();
        await expect(db.withTransaction(async client => {
            await client.query('TRUNCATE media_server_items CASCADE');
            const result = await client.query('SELECT revision::text, refreshed_revision::text FROM library_profile_inventory_state WHERE library_id = $1', [libraryIds[0]]);
            expect(result.rows[0]).toEqual({ revision: '2', refreshed_revision: '1' });
            throw new Error('rollback isolated truncate fixture');
        })).rejects.toThrow('rollback isolated truncate fixture');
        expect(await state()).toMatchObject({ revision: '1', refreshed_revision: '1' });
    });
    test.each([
        ['content_rating', 'PG'], ['genres', ['Drama']], ['studio', 'Example'], ['tmdb_id', 7], ['media_type', 'tv'],
        ['metadata', { inventory_tmdb: { version: 1, tmdb_id: 7, media_type: 'movie', keywords: [], original_language: 'fr' } }], ['metadata', { omdb: { data: { rated: 'PG' } } }],
        ['metadata', { inventory_tmdb: { version: 1, tmdb_id: 7, media_type: 'movie', keywords: ['space'], original_language: null } }],
    ])('captures changes to observed input %s (%j)', async (field, value) => {
        await add();
        // Field names come only from this fixed fixture matrix, never external input.
        await db.query(`UPDATE media_server_items SET ${field} = $2 WHERE library_id = $1`, [libraryIds[0], value]);
        expect((await state()).revision).toBe('2');
    });
    test('rolls back revision changes with the source transaction', async () => {
        await add();
        await expect(db.withTransaction(async client => {
            await client.query("UPDATE media_server_items SET genres = ARRAY['Drama'] WHERE library_id = $1", [libraryIds[0]]);
            throw new Error('rollback fixture');
        })).rejects.toThrow('rollback fixture');
        expect((await state()).revision).toBe('1');
        expect((await planner.run()).queued).toBe(1);
    });
    test('refreshes a young profile without a policy and stops when the revision is current', async () => {
        await add();
        await profiles.generateProfile(libraryIds[0]);
        await db.query("UPDATE media_server_items SET genres = ARRAY['Drama'] WHERE library_id = $1", [libraryIds[0]]);
        expect((await planner.run()).queued).toBe(1);
        expect((await worker().run()).completed).toBe(1);
        expect((await profiles.getProfile(libraryIds[0])).genre_distribution).toEqual({ Drama: 100 });
        expect(await state()).toMatchObject({ revision: '2', refreshed_revision: '2' });
        expect((await planner.run()).queued).toBe(0);
    });
    test('moves invalidate both libraries, including the now empty source', async () => {
        await add();
        await profiles.generateProfile(libraryIds[0]);
        await db.query('UPDATE media_server_items SET library_id = $2 WHERE library_id = $1', libraryIds);
        expect((await planner.run()).queued).toBe(2);
        const result = await worker().run();
        expect(result).toMatchObject({ completed: 2, completedWithoutProfile: 1 });
        expect(await profiles.getProfile(libraryIds[0])).toBeNull();
        expect((await profiles.getProfile(libraryIds[1])).genre_distribution).toEqual({ Action: 100 });
        expect((await planner.run()).queued).toBe(0);
    });
    test('retains inactive changes until reactivation and clears the last removed item', async () => {
        await add();
        await db.query('UPDATE libraries SET is_active = false WHERE id = $1', [libraryIds[0]]);
        expect((await planner.run()).queued).toBe(0);
        await db.query('UPDATE libraries SET is_active = true WHERE id = $1', [libraryIds[0]]);
        await planner.run();
        await worker().run();
        await db.query('DELETE FROM media_server_items WHERE library_id = $1', [libraryIds[0]]);
        await planner.run();
        expect((await worker().run()).completedWithoutProfile).toBe(1);
        expect(await profiles.getProfile(libraryIds[0])).toBeNull();
        expect((await state()).refreshed_revision).toBe('2');
    });
    test('pauses queued inventory work if the library becomes inactive before claim', async () => {
        await add();
        await planner.run();
        await db.query('UPDATE libraries SET is_active = false WHERE id = $1', [libraryIds[0]]);
        expect((await worker().run()).claimed).toBe(0);
        expect((await state()).refreshed_revision).toBe('0');
        await db.query('UPDATE libraries SET is_active = true WHERE id = $1', [libraryIds[0]]);
        expect((await worker().run()).completed).toBe(1);
    });
    test('a recent native profile request cannot acknowledge dirty inventory', async () => {
        await add();
        await profiles.generateProfile(libraryIds[0]);
        await db.query(`INSERT INTO policy_profile_refresh_outbox
            (source_id, source_event_id, library_id, refresh_reason_id, source_system, request_type)
            VALUES ('native_policy_profile_readiness', $1, $2, 'stale_library_profile', 'policy_native_readiness_profile_refresh', 'native_readiness')`, [randomUUID(), libraryIds[0]]);
        expect((await planner.run()).queued).toBe(0);
        expect((await worker().run()).completedAlreadyCurrent).toBe(1);
        expect((await state()).refreshed_revision).toBe('0');
        expect((await planner.run()).queued).toBe(1);
        expect((await worker().run()).completed).toBe(1);
    });
    test('coalesces simultaneous planning and preserves changes arriving during generation', async () => {
        await add();
        const plans = await Promise.all([planner.run(), planner.run()]);
        expect(plans.reduce((sum, result) => sum + result.queued, 0)).toBe(1);
        await worker({ generateProfile: async libraryId => {
            const profile = await profiles.generateProfile(libraryId);
            await db.query("UPDATE media_server_items SET genres = ARRAY['Drama'] WHERE library_id = $1", [libraryId]);
            return profile;
        } }).run();
        expect(await state()).toMatchObject({ revision: '2', refreshed_revision: '1' });
        expect((await planner.run()).queued).toBe(1);
        await worker().run();
        expect((await profiles.getProfile(libraryIds[0])).genre_distribution).toEqual({ Drama: 100 });
    });
    test('lost claims cannot acknowledge revisions and bigint revisions remain exact', async () => {
        await add();
        await db.query('UPDATE library_profile_inventory_state SET revision = 9007199254740993 WHERE library_id = $1', [libraryIds[0]]);
        await planner.run();
        const claimToken = randomUUID();
        const records = await db.withTransaction(client => claims.claimBatch({ client, claimToken, limit: 1, leaseSeconds: 180 }));
        await profiles.generateProfile(libraryIds[0]);
        expect(await claims.completeClaim({ client: db, outboxId: records[0].id, claimToken: randomUUID() })).toBe(false);
        expect((await state()).refreshed_revision).toBe('0');
        expect(await claims.completeClaim({ client: db, outboxId: records[0].id, claimToken })).toBe(true);
        expect((await state()).refreshed_revision).toBe('9007199254740993');
    });
    test('terminal failure probes recover without another inventory event and retain their cooldown record', async () => {
        await add();
        await planner.run();
        expect((await worker({ generateProfile: async () => { throw new Error('fixture dependency unavailable'); } }, { maxAttempts: 1 }).run()).failed).toBe(1);
        expect((await state()).refreshed_revision).toBe('0');
        expect((await planner.run()).queued).toBe(0);
        await db.query("UPDATE policy_profile_refresh_outbox SET updated_at = NOW() - INTERVAL '40 days' WHERE library_id = $1", [libraryIds[0]]);
        expect(await compactInventoryProfileRefreshes(db)).toBe(0);
        expect((await planner.run()).queued).toBe(1);
        expect((await worker().run()).completed).toBe(1);
        expect((await state()).refreshed_revision).toBe('1');
        expect(await compactInventoryProfileRefreshes(db)).toBe(1);
    });
    test('claim completion and revision acknowledgement roll back together on invalid acknowledgement', async () => {
        await add();
        await planner.run();
        const claimToken = randomUUID();
        const [record] = await db.withTransaction(client => claims.claimBatch({ client, claimToken, limit: 1, leaseSeconds: 180 }));
        await db.query('UPDATE policy_profile_refresh_outbox SET inventory_revision = 2 WHERE id = $1', [record.id]);
        await expect(claims.completeClaim({ client: db, outboxId: record.id, claimToken })).rejects.toMatchObject({ code: '23514' });
        expect((await db.query('SELECT processing_state FROM policy_profile_refresh_outbox WHERE id = $1', [record.id])).rows[0].processing_state).toBe('processing');
        expect((await state()).refreshed_revision).toBe('0');
    });
    test('library deletion removes revision state and orphaned inventory work', async () => {
        await add();
        await planner.run();
        await db.query('DELETE FROM libraries WHERE id = $1', [libraryIds[0]]);
        expect(await state()).toBeUndefined();
        expect((await planner.run()).compacted).toBe(1);
        expect((await worker().run()).claimed).toBe(0);
    });
    test('rejects fabricated learning authority on inventory work', async () => {
        await add();
        await planner.run();
        await expect(db.query('UPDATE policy_profile_refresh_outbox SET classification_id = 42 WHERE library_id = $1', [libraryIds[0]])).rejects.toMatchObject({ code: '23514' });
        await expect(db.query('UPDATE policy_profile_refresh_outbox SET inventory_revision = NULL WHERE library_id = $1', [libraryIds[0]])).rejects.toMatchObject({ code: '23514' });
    });
});
