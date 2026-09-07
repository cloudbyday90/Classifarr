/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { readOmdbQuota, reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';
import { persistMetadataProviderConfig } from '../../services/metadataProviderConfigStore.mjs';
import { buildOmdbConfigMutationPayload } from '../../routes/helpers/metadataProviderSettingsSupport.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { checkAndIncrementUsage } = await import('../../services/omdbQuota.mjs');
const integrity = { warnProviderRuntimeFailure: jest.fn() };
const database = createIntegrationDatabaseModuleMock();
const { restoreOmdbConfig } = await import('../../services/backupRestoreTables.mjs');

// Change only the database clock in these tests; production callers cannot supply a day.
function atInstant(instant, zone = 'UTC') {
    const queryWithClock = target => (sql, params) => sql.includes('statement_timestamp()')
        ? target.query(sql.replace('statement_timestamp()', '$1::timestamptz'), [instant])
        : target.query(sql, params);
    return {
        query: queryWithClock(getPool()),
        withTransaction: work => database.withTransaction(async client => {
            await client.query("SELECT set_config('TimeZone', $1, true)", [zone]);
            return work({ query: queryWithClock(client) });
        }),
    };
}

beforeEach(async () => {
    jest.clearAllMocks();
    await getPool().query('TRUNCATE omdb_config RESTART IDENTITY');
});

test('admits exactly the remaining quota under simultaneous requests', async () => {
    await getPool().query(`INSERT INTO omdb_config(api_key, daily_limit, requests_today, last_reset_date)
        VALUES ('quota-fixture', 3, 0, CURRENT_DATE)`);
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => checkAndIncrementUsage({ metadataProviderIntegrityService: integrity })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(9);
    expect((await getPool().query('SELECT requests_today FROM omdb_config')).rows[0].requests_today).toBe(3);
});

test.each(['UTC', 'America/New_York', 'Asia/Tokyo'])('resets once at UTC midnight regardless of session zone %s', async zone => {
    await getPool().query(`INSERT INTO omdb_config(api_key, daily_limit, requests_today, last_reset_date)
        VALUES ('quota-fixture', 4, 3, '2026-09-07')`);
    expect((await reserveOmdbQuota(atInstant('2026-09-07T23:59:59.999Z', zone))).status).toBe('reserved');
    expect((await reserveOmdbQuota(atInstant('2026-09-07T23:59:59.999Z', zone))).status).toBe('limit_reached');
    const midnight = atInstant('2026-09-08T00:00:00Z', zone);
    const results = await Promise.all(Array.from({ length: 12 }, () => reserveOmdbQuota(midnight)));
    expect(results.filter(result => result.status === 'reserved')).toHaveLength(4);
    expect(results.filter(result => result.status === 'limit_reached')).toHaveLength(8);
    expect((await readOmdbQuota(midnight))).toMatchObject({ status: 'limit_reached', used: 4, day: '2026-09-08' });
    expect((await getPool().query("SELECT requests_today, to_char(last_reset_date, 'YYYY-MM-DD') AS day FROM omdb_config")).rows[0])
        .toEqual({ requests_today: 4, day: '2026-09-08' });
});

test('availability is advisory and does not mutate an expired counter', async () => {
    await getPool().query(`INSERT INTO omdb_config(api_key, daily_limit, requests_today, last_reset_date)
        VALUES ('quota-fixture', 10, 10, '2026-09-06')`);
    const quota = await readOmdbQuota(atInstant('2026-09-07T12:00:00Z'));
    expect(quota).toEqual({ status: 'available', used: 0, limit: 10, day: '2026-09-07' });
    expect(JSON.stringify(quota)).not.toContain('quota-fixture');
    expect((await getPool().query('SELECT requests_today FROM omdb_config')).rows[0].requests_today).toBe(10);
});

test.each([
    ['disabled', 'is_active = false', 'not_configured'],
    ['blank key', "api_key = '  '", 'not_configured'],
    ['missing limit', 'daily_limit = NULL', 'invalid_configuration'],
    ['zero limit', 'daily_limit = 0', 'invalid_configuration'],
    ['negative limit', 'daily_limit = -1', 'invalid_configuration'],
    ['negative count', 'requests_today = -1', 'invalid_configuration'],
    ['future day', "last_reset_date = '2026-09-08'", 'invalid_configuration'],
])('does not admit or mutate %s configuration', async (_label, change, status) => {
    await getPool().query("INSERT INTO omdb_config(api_key, last_reset_date) VALUES ('quota-fixture', '2026-09-07')");
    await getPool().query(`UPDATE omdb_config SET ${change}`);
    const before = (await getPool().query('SELECT * FROM omdb_config')).rows;
    expect((await reserveOmdbQuota(atInstant('2026-09-07T12:00:00Z'))).status).toBe(status);
    expect((await getPool().query('SELECT * FROM omdb_config')).rows).toEqual(before);
});

test('empty configuration fails closed and undated/null usage starts conservatively', async () => {
    const clock = atInstant('2026-09-07T12:00:00Z');
    expect((await reserveOmdbQuota(clock)).status).toBe('not_configured');
    await getPool().query("INSERT INTO omdb_config(api_key, requests_today, last_reset_date) VALUES ('quota-fixture', 37, NULL)");
    expect((await reserveOmdbQuota(clock)).status).toBe('reserved');
    expect((await readOmdbQuota(clock)).used).toBe(38);
    await getPool().query('UPDATE omdb_config SET requests_today = NULL, last_reset_date = NULL');
    expect((await reserveOmdbQuota(clock)).status).toBe('reserved');
    expect((await readOmdbQuota(clock)).used).toBe(1);
});

test('uses the highest active ID without falling back to another credential when its quota is exhausted', async () => {
    await getPool().query(`INSERT INTO omdb_config(api_key, is_active, daily_limit, requests_today, last_reset_date) VALUES
        ('older', true, 10, 0, '2026-09-07'), ('selected', true, 1, 1, '2026-09-07'), ('inactive', false, 10, 0, '2026-09-07')`);
    expect((await reserveOmdbQuota(atInstant('2026-09-07T12:00:00Z'))).status).toBe('limit_reached');
    expect((await getPool().query('SELECT requests_today FROM omdb_config ORDER BY id')).rows.map(row => row.requests_today)).toEqual([0, 1, 0]);
});

test('maximum integer quota stops without overflowing storage', async () => {
    await getPool().query(`INSERT INTO omdb_config(api_key, daily_limit, requests_today, last_reset_date)
        VALUES ('quota-fixture', 2147483647, 2147483646, '2026-09-07')`);
    const clock = atInstant('2026-09-07T12:00:00Z');
    expect((await reserveOmdbQuota(clock)).status).toBe('reserved');
    expect((await reserveOmdbQuota(clock)).status).toBe('limit_reached');
    expect((await readOmdbQuota(clock)).used).toBe(2147483647);
});

test('rollback after reservation update leaves usage unchanged', async () => {
    await getPool().query("INSERT INTO omdb_config(api_key) VALUES ('quota-fixture')");
    const aborting = { withTransaction: work => database.withTransaction(async client => {
        await work(client);
        throw new Error('simulated commit failure');
    }) };
    await expect(reserveOmdbQuota(aborting)).rejects.toThrow('simulated commit failure');
    expect((await getPool().query('SELECT requests_today FROM omdb_config')).rows[0].requests_today).toBe(0);
});

test('concurrent settings and backup restore preserve every committed reservation', async () => {
    await getPool().query("INSERT INTO omdb_config(api_key) VALUES ('quota-fixture')");
    const operations = Array.from({ length: 24 }, () => reserveOmdbQuota(database));
    operations.push(database.withTransaction(client => persistMetadataProviderConfig(client, 'omdb',
        existing => buildOmdbConfigMutationPayload({ api_key: 'rotated-fixture', daily_limit: 2000 }, existing))));
    operations.push(database.withTransaction(client => restoreOmdbConfig(client, { api_key: 'restored-fixture' })));
    await Promise.all(operations);
    const rows = (await getPool().query('SELECT id, requests_today FROM omdb_config')).rows;
    expect(rows).toEqual([{ id: 1, requests_today: 24 }]);
});
