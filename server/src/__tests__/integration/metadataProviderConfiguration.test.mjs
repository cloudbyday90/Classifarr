/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as delay } from 'node:timers/promises';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { persistMetadataProviderConfig, readMetadataProviderConfig } from '../../services/metadataProviderConfigStore.mjs';
import { buildOmdbConfigMutationPayload, buildTavilyConfigMutationPayload, buildTmdbConfigMutationPayload } from '../../routes/helpers/metadataProviderSettingsSupport.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { restoreTmdbConfig, restoreOmdbConfig } = await import('../../services/backupRestoreTables.mjs');
const providers = [
    ['tmdb', buildTmdbConfigMutationPayload], ['omdb', buildOmdbConfigMutationPayload], ['tavily', buildTavilyConfigMutationPayload],
];

beforeEach(async () => {
    await getPool().query('TRUNCATE tmdb_config, omdb_config, tavily_config RESTART IDENTITY');
});
async function transaction(work) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}
async function waitForBlock(waiter, blocker) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        const { rows } = await getPool().query('SELECT $1::int = ANY(pg_blocking_pids($2)) AS blocked', [blocker.processID, waiter.processID]);
        if (rows[0].blocked) return;
        await delay(20);
    }
    throw new Error('Expected configuration writer did not wait for the transaction lock');
}

describe.each(providers)('%s configuration transaction', (provider, buildPayload) => {
    const save = (client, body) => persistMetadataProviderConfig(client, provider, existing => buildPayload(body, existing));

    test('serializes concurrent first saves and preserves the committed key in a masked follow-up', async () => {
        const first = await getPool().connect();
        const second = await getPool().connect();
        let waiting;
        let drained;
        try {
            await first.query('BEGIN'); await second.query('BEGIN');
            const initial = await save(first, { api_key: 'rotated-fixture-key' });
            waiting = save(second, { api_key: '••••••••-masked' });
            drained = Promise.allSettled([waiting]);
            await waitForBlock(second, first);
            // Ordinary readers are not blocked by the configuration writer lock.
            expect(await readMetadataProviderConfig(getPool(), provider, { activeOnly: true })).toBeNull();
            await first.query('COMMIT');
            const updated = await waiting;
            await second.query('COMMIT');
            expect(updated.rows[0]).toMatchObject({ id: initial.rows[0].id, api_key: 'rotated-fixture-key' });
            const count = await getPool().query(`SELECT count(*)::int AS total FROM ${provider}_config`);
            expect(count.rows[0].total).toBe(1);
        } finally {
            await first.query('ROLLBACK');
            // Drain after releasing the blocker; the main awaited operation above reports failure.
            await drained;
            await second.query('ROLLBACK');
            first.release(); second.release();
        }
    });

    test('selects an active row ahead of newer inactive rows and retains every row on replacement', async () => {
        await getPool().query(`INSERT INTO ${provider}_config (api_key, is_active) VALUES
            ('older-active', true), ('selected-active', true), ('newer-inactive', false)`);
        expect(await readMetadataProviderConfig(getPool(), provider)).toMatchObject({ id: 2, api_key: 'selected-active' });
        expect(await readMetadataProviderConfig(getPool(), provider, { activeOnly: true })).toMatchObject({ id: 2 });
        await transaction(client => save(client, { api_key: 'replacement' }));
        const rows = (await getPool().query(`SELECT id, api_key, is_active FROM ${provider}_config ORDER BY id`)).rows;
        expect(rows).toEqual([{ id: 1, api_key: 'older-active', is_active: false },
            { id: 2, api_key: 'replacement', is_active: true }, { id: 3, api_key: 'newer-inactive', is_active: false }]);
        await getPool().query(`UPDATE ${provider}_config SET is_active = false`);
        expect(await readMetadataProviderConfig(getPool(), provider, { activeOnly: true })).toBeNull();
        expect(await readMetadataProviderConfig(getPool(), provider)).toMatchObject({ id: 3 });
    });

    test('rolls back both the new configuration and deactivation when the transaction fails', async () => {
        await getPool().query(`INSERT INTO ${provider}_config (api_key) VALUES ('first'), ('second')`);
        await expect(transaction(async client => { await save(client, { api_key: 'discarded' }); throw new Error('abort'); }))
            .rejects.toThrow('abort');
        const rows = (await getPool().query(`SELECT api_key, is_active FROM ${provider}_config ORDER BY id`)).rows;
        expect(rows).toEqual([{ api_key: 'first', is_active: true }, { api_key: 'second', is_active: true }]);
    });
});

test.each([['tmdb', restoreTmdbConfig], ['omdb', restoreOmdbConfig]])('repeated %s restores reuse the selected ID and honor inactive backups', async (provider, restore) => {
    await transaction(client => restore(client, { api_key: 'restored', language: 'fr-FR', daily_limit: 900 }));
    await transaction(client => restore(client, { api_key: 'restored-again', is_active: false }));
    const rows = (await getPool().query(`SELECT * FROM ${provider}_config`)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, api_key: 'restored-again', is_active: false });
    if (provider === 'tmdb') expect(rows[0].language).toBe('fr-FR');
    else expect(rows[0].daily_limit).toBe(900);
});

test('an OMDb save does not lose a concurrent quota increment or replace its row identity', async () => {
    await getPool().query("INSERT INTO omdb_config(api_key, requests_today, last_reset_date) VALUES ('original', 25, CURRENT_DATE)");
    const writer = await getPool().connect();
    const counter = await getPool().connect();
    let waiting;
    let drained;
    try {
        await writer.query('BEGIN');
        await persistMetadataProviderConfig(writer, 'omdb', existing => buildOmdbConfigMutationPayload({ daily_limit: 2000 }, existing));
        waiting = counter.query('UPDATE omdb_config SET requests_today = requests_today + 1 WHERE id = 1');
        drained = Promise.allSettled([waiting]);
        await waitForBlock(counter, writer);
        await writer.query('COMMIT');
        await waiting;
        expect(await readMetadataProviderConfig(getPool(), 'omdb')).toMatchObject({ id: 1, requests_today: 26, daily_limit: 2000 });
    } finally { await writer.query('ROLLBACK'); await drained; writer.release(); counter.release(); }
});

test('OMDb restores preserve current usage instead of resetting a live quota', async () => {
    await getPool().query("INSERT INTO omdb_config(api_key, requests_today, last_reset_date) VALUES ('original', 37, CURRENT_DATE)");
    await transaction(client => restoreOmdbConfig(client, { api_key: 'restored', daily_limit: 2000 }));
    expect(await readMetadataProviderConfig(getPool(), 'omdb')).toMatchObject({ id: 1, requests_today: 37, daily_limit: 2000 });
});
