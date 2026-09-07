/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';

const migration = await readFile(new URL('../../../../database/migrations/20260907_180000_consolidate_equivalent_metadata_providers.sql', import.meta.url), 'utf8');
let client;
beforeEach(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');
    await client.query('TRUNCATE tmdb_config, omdb_config, tavily_config RESTART IDENTITY');
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });

test.each(['tmdb', 'omdb', 'tavily'])('consolidates equivalent %s active rows without deleting any credential', async provider => {
    await client.query(`INSERT INTO ${provider}_config(api_key, is_active) VALUES
        ('retained-key', true), ('retained-key', true), ('retained-key', true), ('inactive-other-key', false)`);
    await client.query(migration);
    const read = () => client.query(`SELECT id, api_key, is_active FROM ${provider}_config ORDER BY id`);
    const repaired = (await read()).rows;
    expect(repaired).toEqual([{ id: 1, api_key: 'retained-key', is_active: false },
        { id: 2, api_key: 'retained-key', is_active: false }, { id: 3, api_key: 'retained-key', is_active: true },
        { id: 4, api_key: 'inactive-other-key', is_active: false }]);
    await client.query(migration);
    expect((await read()).rows).toEqual(repaired);
});

test.each(['tmdb', 'omdb', 'tavily'])('does not infer credential authority for conflicting %s rows', async provider => {
    await client.query(`INSERT INTO ${provider}_config(api_key) VALUES ('first-key'), ('second-key'), ('second-key')`);
    const original = (await client.query(`SELECT * FROM ${provider}_config ORDER BY id`)).rows;
    await client.query(migration);
    expect((await client.query(`SELECT * FROM ${provider}_config ORDER BY id`)).rows).toEqual(original);
});

test.each([
    ['tmdb', "language = 'fr-FR'"], ['tmdb', 'language = NULL'],
    ['omdb', 'daily_limit = 500'], ['tavily', "include_domains = ARRAY['different.example']"],
])('preserves %s rows with different operational settings (%s)', async (provider, change) => {
    await client.query(`INSERT INTO ${provider}_config(api_key) VALUES ('same-key'), ('same-key')`);
    await client.query(`UPDATE ${provider}_config SET ${change} WHERE id = 2`);
    await client.query(migration);
    expect((await client.query(`SELECT count(*)::int AS active FROM ${provider}_config WHERE is_active`)).rows[0].active).toBe(2);
});

test('combines current-day OMDb usage conservatively while retaining historical counters', async () => {
    await client.query(`INSERT INTO omdb_config(api_key, requests_today, last_reset_date) VALUES
        ('same-key', 17, CURRENT_DATE), ('same-key', 23, CURRENT_DATE), ('same-key', 90, CURRENT_DATE - 1)`);
    await client.query(migration);
    expect((await client.query('SELECT id, requests_today, last_reset_date = CURRENT_DATE AS today FROM omdb_config ORDER BY id')).rows)
        .toEqual([{ id: 1, requests_today: 17, today: true }, { id: 2, requests_today: 23, today: true },
            { id: 3, requests_today: 40, today: true }]);
});

test('saturates oversized aggregate usage rather than failing the upgrade', async () => {
    await client.query(`INSERT INTO omdb_config(api_key, requests_today, last_reset_date) VALUES
        ('same-key', 2000000000, CURRENT_DATE), ('same-key', 2000000000, CURRENT_DATE)`);
    await client.query(migration);
    expect((await client.query('SELECT requests_today FROM omdb_config WHERE is_active')).rows[0].requests_today).toBe(2147483647);
});

test('leaves empty and single configurations unchanged', async () => {
    await client.query("INSERT INTO tmdb_config(api_key) VALUES ('only-key')");
    const before = (await client.query('SELECT * FROM tmdb_config')).rows;
    await client.query(migration);
    expect((await client.query('SELECT * FROM tmdb_config')).rows).toEqual(before);
    expect((await client.query('SELECT count(*)::int AS total FROM omdb_config')).rows[0].total).toBe(0);
});
