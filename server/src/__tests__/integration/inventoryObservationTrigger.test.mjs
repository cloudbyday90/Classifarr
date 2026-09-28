/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import fs from 'node:fs';
import { beforeEach, afterEach, describe, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';

const read = name => fs.readFileSync(new URL(`../../../../${name}`, import.meta.url), 'utf8');
const migration = read('database/migrations/20260928_060000_stabilize_inventory_observation_trigger.sql');
const original = read('database/migrations/20260927_130000_add_inventory_provider_recovery.sql')
    .split('DROP TRIGGER reset_inventory_tmdb_observation_clocks ON media_server_items;')[1];
const snapshot = read('database/schema/current.sql')
    .match(/^CREATE TRIGGER reset_inventory_tmdb_observation_clocks .*;$/m)[0];
const resetFields = ['inventory_tmdb_attempted_at', 'inventory_tmdb_fetched_at',
    'inventory_tmdb_recovery', 'inventory_tmdb_retry_after', 'inventory_tmdb_lease_id', 'inventory_tmdb_lease_until'];
const cases = [
    ['tmdb_id', 7, 8, true], ['media_type', 'movie', 'tv', false],
    ['library_id', 'libraryA', 'libraryB', true], ['media_server_id', 'serverA', 'serverB', true],
    ['external_id', 'source-a', 'source-b', false], ['title', 'Synthetic', 'Changed', false],
    ['year', 2001, 2002, true], ['imdb_id', 'tt123', 'tt456', true], ['tvdb_id', 11, 12, true],
];

let client, ids, itemId;
beforeEach(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');
    const servers = (await client.query(`INSERT INTO media_server (type, name, url, api_key)
        VALUES ('plex', 'Synthetic A', 'http://fixture.invalid', 'fixture'),
               ('jellyfin', 'Synthetic B', 'http://fixture.invalid', 'fixture') RETURNING id`)).rows;
    const libraries = (await client.query(`INSERT INTO libraries (name, external_id, media_type)
        VALUES ('Synthetic A', 'fixture-a', 'movie'), ('Synthetic B', 'fixture-b', 'tv') RETURNING id`)).rows;
    ids = { serverA: servers[0].id, serverB: servers[1].id, libraryA: libraries[0].id, libraryB: libraries[1].id };
    itemId = (await client.query(`INSERT INTO media_server_items
        (external_id, title, media_type, library_id, media_server_id, tmdb_id, year, imdb_id, tvdb_id, metadata)
        VALUES ('source-a', 'Synthetic', 'movie', $1, $2, 7, 2001, 'tt123', 11, '{"retained":true}') RETURNING id`,
    [ids.libraryA, ids.serverA])).rows[0].id;
});
afterEach(async () => {
    try { if (client) await client.query('ROLLBACK'); }
    finally { client?.release(); client = undefined; }
});

const row = async () => (await client.query('SELECT * FROM media_server_items WHERE id=$1', [itemId])).rows[0];
const recovery = value => Object.fromEntries(resetFields.map(field => [field, value[field]]));
async function seedRecovery() {
    await client.query(`UPDATE media_server_items SET inventory_tmdb_attempted_at=NOW(),
        inventory_tmdb_fetched_at=NOW(), inventory_tmdb_recovery='{"version":1,"status":"open"}',
        inventory_tmdb_retry_after=NOW()+interval '1 day',
        inventory_tmdb_lease_id='11111111-1111-4111-8111-111111111111',
        inventory_tmdb_lease_until=NOW()+interval '1 minute' WHERE id=$1`, [itemId]);
}
async function replaceTrigger(ddl) {
    await client.query('DROP TRIGGER reset_inventory_tmdb_observation_clocks ON public.media_server_items');
    await client.query(ddl);
}
const definition = async () => (await client.query(`SELECT pg_get_triggerdef(oid, false) AS ddl
    FROM pg_trigger WHERE tgrelid='public.media_server_items'::regclass
    AND tgname='reset_inventory_tmdb_observation_clocks'`)).rows[0].ddl;

describe.each(['historical row predicate', 'forward migration', 'fresh snapshot'])('%s', mode => {
    beforeEach(async () => {
        await replaceTrigger(original);
        if (mode === 'forward migration') await client.query(migration);
        if (mode === 'fresh snapshot') await replaceTrigger(snapshot);
    });

    test.each(cases)('%s changes reset recovery; unchanged values retain it', async (field, first, second, nullable) => {
        const a = ids[first] ?? first;
        const b = ids[second] ?? second;
        const transitions = [[a, b, true], [a, a, false]];
        if (nullable) transitions.push([a, null, true], [null, a, true], [null, null, false]);
        for (const [from, to, changed] of transitions) {
            // Field identifiers come only from the fixed test matrix above.
            await client.query(`UPDATE media_server_items SET ${field}=$2 WHERE id=$1`, [itemId, from]);
            await seedRecovery();
            const before = await row();
            await client.query(`UPDATE media_server_items SET ${field}=$2 WHERE id=$1`, [itemId, to]);
            const after = await row();
            expect(recovery(after)).toEqual(changed
                ? Object.fromEntries(resetFields.map(name => [name, null])) : recovery(before));
            expect(after.metadata).toEqual(before.metadata);
            expect(after.id).toBe(itemId);
        }
    });

    test('unrelated metadata writes preserve recovery and the active lease', async () => {
        await seedRecovery();
        const before = await row();
        await client.query(`UPDATE media_server_items SET metadata='{"retained":true,"updated":true}' WHERE id=$1`, [itemId]);
        expect(recovery(await row())).toEqual(recovery(before));
    });
});

test('forward migration converges the legacy deparser output without changing stored items', async () => {
    await replaceTrigger(original);
    await seedRecovery();
    const before = await row();
    const legacy = await definition();
    await replaceTrigger(legacy);
    const restored = await definition();
    expect(restored).not.toBe(legacy); // Reproduces PostgreSQL's nested-to-flat OR reconstruction.
    await replaceTrigger(restored);
    expect(await definition()).toBe(restored);
    await replaceTrigger(original);
    await client.query(migration);
    const canonical = await definition();
    expect(canonical).toBe(restored);
    await client.query(migration);
    expect(await definition()).toBe(canonical);
    await replaceTrigger(canonical);
    expect(await definition()).toBe(canonical);
    await replaceTrigger(snapshot);
    expect(await definition()).toBe(canonical);
    expect(await row()).toEqual(before);
});

test('replacement rolls back atomically with its enclosing migration transaction', async () => {
    await replaceTrigger(original);
    const legacy = await definition();
    await seedRecovery();
    const before = await row();
    await client.query('SAVEPOINT trigger_migration');
    await client.query(migration);
    expect(await definition()).not.toBe(legacy);
    await client.query('ROLLBACK TO SAVEPOINT trigger_migration');
    expect(await definition()).toBe(legacy);
    expect(await row()).toEqual(before);
});
