/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';
import { createOmdbSslRecovery, createOmdbSslProbe } from '../../services/omdbSslRecovery.mjs';
import { readHealthProbeJson } from '../../services/healthProbeRequest.mjs';
import { reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';
import { deferOmdbPacing } from '../../services/omdbPacingStore.mjs';
import { metadataProviderDefinition } from '../../services/metadataProviderConfigSql.mjs';
import { createOmdbHealthAdmission } from '../../services/healthOmdbAdmission.mjs';
import { createMetadataHealthProbes } from '../../services/healthMetadataProbe.mjs';

const db = createIntegrationDatabaseModuleMock();
const config = async () => (await db.query('SELECT * FROM omdb_config WHERE is_active ORDER BY id DESC LIMIT 1')).rows[0];
const credits = async () => (await db.query('SELECT requests_today FROM omdb_config')).rows[0].requests_today;
let server, calls, handler, recover, probe, readJson, requestFailure;
const success = { Response: 'True', Title: 'Fixture', imdbID: 'tt0133093', Type: 'movie' };

beforeEach(async () => {
    await seedOmdbQuotaFixture(db); calls = 0; requestFailure = null;
    handler = async (_req, res) => {
        expect(await credits()).toBe(1);
        // Independent connection proves the admission transaction no longer holds its lock.
        await db.withTransaction(async client => {
            await client.query("SET LOCAL lock_timeout='100ms'");
            await client.query(metadataProviderDefinition('omdb').lock);
        });
        res.end(JSON.stringify(success));
    };
    server = createServer((req, res) => {
        calls++; res.setHeader('Content-Type', 'application/json');
        handler(req, res).catch(error => { requestFailure = error; res.statusCode = 500; res.end('{}'); });
    });
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const target = `http://127.0.0.1:${server.address().port}`;
    readJson = (url, headers, options) => {
        expect(url).toBe('https://www.omdbapi.com/');
        return readHealthProbeJson(target, headers, options);
    };
    probe = createOmdbSslProbe({ readJson }); recover = createOmdbSslRecovery({ db, probe });
});
afterEach(async () => {
    server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); });
    expect(requestFailure).toBeNull();
});

test('recovery commits one credit before HTTP and the following lookup obeys the shared floor', async () => {
    expect((await recover(await config())).status).toBe('recovered');
    expect(calls).toBe(1); expect(await credits()).toBe(1);
    expect((await reserveOmdbQuota(db, { pacing: true })).status).toBe('paced');
    expect(await credits()).toBe(1);
});

test('competing System health, recovery and lookups share the last credit', async () => {
    await db.query('UPDATE omdb_config SET daily_limit=1');
    const saved = await config();
    const health = createOmdbHealthAdmission({ db, probe: createMetadataHealthProbes({ readJson }).probeOmdbConnection });
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => i % 3 === 0
        ? recover(saved) : i % 3 === 1 ? health({}, saved) : reserveOmdbQuota(db, { pacing: true })));
    expect(results.filter(row => ['recovered', 'connected', 'reserved'].includes(row.status))).toHaveLength(1);
    expect(await credits()).toBe(1); expect(calls).toBeLessThanOrEqual(1);
});

test('reconstructed caller retains persisted provider cooldown and credits', async () => {
    const admitted = await reserveOmdbQuota(db, { pacing: true });
    await deferOmdbPacing(db, admitted.credentialContext, 120);
    const restarted = createOmdbSslRecovery({ db: createIntegrationDatabaseModuleMock(), probe });
    expect(await restarted(await config())).toEqual({ status: 'deferred', code: 'paced' });
    expect(await credits()).toBe(1); expect(calls).toBe(0);
});

test.each(['rollback', 'uncertain_commit'])('%s never dispatches or refunds', async mode => {
    const broken = { withTransaction: async work => {
        if (mode === 'rollback') return db.withTransaction(async client => { await work(client); throw new Error('rollback'); });
        await db.withTransaction(work); throw new Error('reply lost');
    } };
    expect(await createOmdbSslRecovery({ db: broken, probe })(await config()))
        .toEqual({ status: 'deferred', code: 'admission_unavailable' });
    expect(calls).toBe(0); expect(await credits()).toBe(mode === 'rollback' ? 0 : 1);
});

test.each([
    ["UPDATE omdb_config SET requests_today=daily_limit", 'limit_reached'],
    ["UPDATE omdb_config SET credential_rejected_at=clock_timestamp()", 'credentials_rejected'],
    ["UPDATE omdb_config SET daily_limit=0", 'invalid_configuration'],
    ["UPDATE omdb_config SET is_active=false", 'not_configured'],
    ["UPDATE omdb_config SET api_key='changed fixture'", 'lookup_restart'],
])('denied %s cannot probe', async (sql, code) => {
    const saved = await config(); await db.query(sql); const before = await credits();
    expect(await recover(saved)).toEqual({ status: 'deferred', code });
    expect(calls).toBe(0); expect(await credits()).toBe(before);
});

test.each(["api_key='replacement fixture'", 'is_active=false', 'credential_rejected_at=clock_timestamp()'])('fences in-flight change: %s', async change => {
    handler = async (_req, res) => {
        await db.query(`UPDATE omdb_config SET ${change}`);
        res.end(JSON.stringify(success));
    };
    expect(await recover(await config())).toEqual({ status: 'deferred', code: 'configuration_changed' });
    expect(calls).toBe(1); expect(await credits()).toBe(1);
});

test('lock contention defers without spending or HTTP', async () => {
    const saved = await config(), blocker = await getPool().connect();
    try {
        await blocker.query('BEGIN'); await blocker.query(metadataProviderDefinition('omdb').lock);
        expect(await recover(saved)).toEqual({ status: 'deferred', code: 'admission_unavailable' });
    } finally { await blocker.query('ROLLBACK'); blocker.release(); }
    expect(calls).toBe(0); expect(await credits()).toBe(0);
});

test.each([
    [200, { Response: 'False', Error: 'Movie not found!' }, 'recovered'],
    [200, { Response: 'True' }, 'deferred'],
    [401, { Response: 'False', Error: 'Invalid API key!' }, 'deferred'],
    [429, { Response: 'False', Error: 'Request limit reached!' }, 'deferred'],
])('real HTTP %s %j recovery=%s', async (status, body, expected) => {
    handler = async (_req, res) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    expect((await recover(await config())).status).toBe(expected);
    expect(calls).toBe(1); expect(await credits()).toBe(1);
});

test('redirects and oversized bodies cannot authorize recovery or make another request', async () => {
    handler = async (_req, res) => { res.statusCode = 302; res.setHeader('Location', '/other'); res.end(); };
    expect((await recover(await config())).status).toBe('deferred'); expect(calls).toBe(1);
    await seedOmdbQuotaFixture(db); calls = 0;
    handler = async (_req, res) => { res.end('x'.repeat(1_048_577)); };
    expect((await recover(await config())).status).toBe('deferred');
    expect(calls).toBe(1); expect(await credits()).toBe(1);
});
