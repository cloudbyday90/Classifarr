/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';
import { createOmdbHealthAdmission } from '../../services/healthOmdbAdmission.mjs';
import { createMetadataHealthProbes } from '../../services/healthMetadataProbe.mjs';
import { readHealthProbeJson } from '../../services/healthProbeRequest.mjs';
import { reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';
import { deferOmdbPacing } from '../../services/omdbPacingStore.mjs';
import { metadataProviderDefinition } from '../../services/metadataProviderConfigSql.mjs';
import { createHealthObservationCoordinator } from '../../services/healthObservationCoordinator.mjs';
import { healthConfigurationQuery } from '../../services/healthConfigurationQueries.mjs';
import { readHealthConfiguration } from '../../services/healthConfigurationRead.mjs';

const db = createIntegrationDatabaseModuleMock();
const config = async () => (await db.query(healthConfigurationQuery('omdb'))).rows[0];
const credits = async () => (await db.query('SELECT requests_today FROM omdb_config')).rows[0].requests_today;
const previous = { status: 'connected', lastSuccessfulCheck: '2026-10-01T00:00:00Z' };
let server, base, calls, handler, probe, check, requestFailure;

beforeEach(async () => {
    await seedOmdbQuotaFixture(db);
    calls = 0; requestFailure = null;
    handler = async (_req, res) => {
        // Separate connection proves both visibility and lock release before HTTP.
        expect(await credits()).toBe(1);
        await db.withTransaction(async client => {
            await client.query("SET LOCAL lock_timeout='100ms'");
            await client.query(metadataProviderDefinition('omdb').lock);
        });
        res.end(JSON.stringify({ Response: 'True', Title: 'Fixture', imdbID: 'tt0133093', Type: 'movie' }));
    };
    server = createServer((req, res) => {
        calls++;
        res.setHeader('Content-Type', 'application/json');
        handler(req, res).catch(error => { requestFailure = error; res.statusCode = 500; res.end('{}'); });
    });
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
    probe = createMetadataHealthProbes({ readJson: (url, headers, options) => {
        expect(url).toBe('https://www.omdbapi.com/');
        return readHealthProbeJson(base, headers, options);
    } }).probeOmdbConnection;
    check = createOmdbHealthAdmission({ db, probe });
});

afterEach(async () => {
    server.closeAllConnections();
    await new Promise(resolve => { server.close(resolve); });
    expect(requestFailure).toBeNull();
});

test('an admitted health request commits exactly one credit before real HTTP', async () => {
    expect((await check(previous, await config())).status).toBe('connected');
    expect(calls).toBe(1); expect(await credits()).toBe(1);
});

test('concurrent health and lookup callers share the final daily credit', async () => {
    await db.query('UPDATE omdb_config SET daily_limit=1');
    const saved = await config();
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => i % 2
        ? reserveOmdbQuota(db, { pacing: true }) : check(previous, saved)));
    expect(results.filter(row => ['reserved', 'connected'].includes(row.status))).toHaveLength(1);
    expect(await credits()).toBe(1); expect(calls).toBeLessThanOrEqual(1);
    expect(results.filter(row => row.status === 'unknown')
        .every(row => row.failure.code === 'local_quota_exhausted')).toBe(true);
});

test('restart honors the durable lookup floor and provider cooldown without spending', async () => {
    const admitted = await reserveOmdbQuota(db, { pacing: true });
    await deferOmdbPacing(db, admitted.credentialContext, 120);
    const restarted = createOmdbHealthAdmission({ db: createIntegrationDatabaseModuleMock(), probe });
    expect(await restarted(previous, await config())).toMatchObject({ status: 'unknown',
        failure: { code: 'provider_wait' }, lastSuccessfulCheck: previous.lastSuccessfulCheck });
    expect(await credits()).toBe(1); expect(calls).toBe(0);
});

test.each(['rollback', 'uncertain_commit'])('%s never sends HTTP or retries reservation', async mode => {
    const uncertainDb = { withTransaction: async work => {
        if (mode === 'rollback') return db.withTransaction(async client => {
            await work(client); throw new Error('rollback fixture');
        });
        await db.withTransaction(work); throw new Error('commit reply lost fixture');
    } };
    const observe = createOmdbHealthAdmission({ db: uncertainDb, probe });
    expect((await observe(previous, await config())).failure.code).toBe('admission_unavailable');
    expect(calls).toBe(0); expect(await credits()).toBe(mode === 'rollback' ? 0 : 1);
});

test.each([
    ["UPDATE omdb_config SET requests_today=daily_limit", 'local_quota_exhausted'],
    ["UPDATE omdb_config SET credential_rejected_at=clock_timestamp()", 'credentials_rejected'],
    ["UPDATE omdb_config SET daily_limit=0", 'admission_configuration_invalid'],
    ["UPDATE omdb_config SET is_active=false", 'configuration_changed'],
    ["UPDATE omdb_config SET api_key='changed fixture'", 'configuration_changed'],
])('denied admission never makes a provider request: %s', async (sql, code) => {
    const saved = await config(); await db.query(sql);
    const before = await credits();
    expect((await check(previous, saved)).failure.code).toBe(code);
    expect(await credits()).toBe(before); expect(calls).toBe(0);
});

test('busy database yields admission guidance without exposing the database error', async () => {
    const saved = await config(), blocker = await getPool().connect();
    try {
        await blocker.query('BEGIN'); await blocker.query(metadataProviderDefinition('omdb').lock);
        expect((await check(previous, saved)).failure.code).toBe('admission_unavailable');
    } finally { await blocker.query('ROLLBACK'); blocker.release(); }
    expect(await credits()).toBe(0); expect(calls).toBe(0);
});

test('daily policy rolls over once and health consumes one new-day credit', async () => {
    await db.query("UPDATE omdb_config SET requests_today=daily_limit,last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date-1");
    expect((await check(previous, await config())).status).toBe('connected');
    expect(await credits()).toBe(1); expect(calls).toBe(1);
});

test('normal configuration guard fences a response after key replacement', async () => {
    const coordinator = createHealthObservationCoordinator();
    handler = async (_req, res) => {
        await db.query("UPDATE omdb_config SET api_key='replacement fixture'");
        res.end(JSON.stringify({ Response: 'True', Title: 'Fixture', imdbID: 'tt0133093', Type: 'movie' }));
    };
    const result = await coordinator.run('omdb', async (old, guard) => {
        const read = await readHealthConfiguration(old, 'omdb', () => db.query(healthConfigurationQuery('omdb')), guard);
        return check(old, read.rows[0]);
    });
    expect(result).toMatchObject({ status: 'unknown', failure: { code: 'configuration_changed' }, lastSuccessfulCheck: null });
    expect(calls).toBe(1); expect(await credits()).toBe(1);
});

test('budget correction invalidates a skipped observation without spending on reconciliation', async () => {
    const coordinator = createHealthObservationCoordinator();
    await db.query('UPDATE omdb_config SET daily_limit=1,requests_today=1');
    const result = await coordinator.run('omdb', async (old, guard) => {
        const read = await readHealthConfiguration(old, 'omdb', () => db.query(healthConfigurationQuery('omdb')), guard);
        return check(old, read.rows[0]);
    });
    expect(result.failure.code).toBe('local_quota_exhausted');
    await coordinator.reconcile(); expect(coordinator.snapshot().omdb).toBe(result);
    await db.query('UPDATE omdb_config SET daily_limit=2');
    await coordinator.reconcile();
    expect(coordinator.snapshot().omdb.failure.code).toBe('configuration_changed');
    expect(calls).toBe(0); expect(await credits()).toBe(1);
});
