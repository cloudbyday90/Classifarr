/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';
import { createOmdbHealthAdmission } from '../../services/healthOmdbAdmission.mjs';
import { createMetadataHealthProbes } from '../../services/healthMetadataProbe.mjs';
import { createOmdbSslRecovery, createOmdbSslProbe } from '../../services/omdbSslRecovery.mjs';
import { readHealthProbeJson } from '../../services/healthProbeRequest.mjs';
import { reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';
import { deferOmdbPacing, readOmdbPacingReadiness } from '../../services/omdbPacingStore.mjs';
import { createOmdbPacingObserver } from '../../services/omdbPacingObservation.mjs';
import { providerCredentialContext } from '../../services/providerCredentialRejection.mjs';
import { metadataProviderDefinition } from '../../services/metadataProviderConfigSql.mjs';
import { OMDB_MAX_WAIT_SECONDS } from '../../services/omdbPacingPolicy.mjs';

const db = createIntegrationDatabaseModuleMock();
const config = async () => (await db.query('SELECT * FROM omdb_config WHERE is_active ORDER BY id DESC LIMIT 1')).rows[0];
const credits = async () => (await db.query('SELECT requests_today FROM omdb_config ORDER BY id DESC LIMIT 1')).rows[0].requests_today;
const valid = { Response: 'True', Title: 'Fixture', imdbID: 'tt0133093', Type: 'movie' };
let server, base, calls, status, header, body, beforeResponse, requestFailure;

function runner(kind, database = db, observe) {
    const readJson = (url, headers, options) => {
        expect(url).toBe('https://www.omdbapi.com/');
        return readHealthProbeJson(base, headers, options);
    };
    return kind === 'health'
        ? saved => createOmdbHealthAdmission({ db: database, observe,
            probe: createMetadataHealthProbes({ readJson }).probeOmdbConnection })({}, saved)
        : createOmdbSslRecovery({ db: database, observe, probe: createOmdbSslProbe({ readJson }) });
}

beforeEach(async () => {
    await seedOmdbQuotaFixture(db);
    calls = 0; status = 429; header = '120'; body = {}; requestFailure = null;
    beforeResponse = async () => {
        expect(await credits()).toBe(1);
        // A separate connection can acquire the admission lock during HTTP.
        await db.withTransaction(async client => {
            await client.query("SET LOCAL lock_timeout='100ms'");
            await client.query(metadataProviderDefinition('omdb').lock);
        });
    };
    server = createServer((_req, res) => {
        calls++;
        beforeResponse().then(() => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            if (header !== undefined) res.setHeader('Retry-After', header);
            res.end(JSON.stringify(body));
        }).catch(error => { requestFailure = error; res.statusCode = 500; res.end('{}'); });
    });
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
    server.closeAllConnections();
    await new Promise(resolve => { server.close(resolve); });
    expect(requestFailure).toBeNull();
});

describe.each(['health', 'ssl'])('%s probe response observation', kind => {
    test.each([200, 429, 503])('HTTP %s blocks all subsequent caller types without another credit', async code => {
        status = code; body = code === 200 ? valid : {};
        const result = await runner(kind)(await config());
        expect(result.status).toBe(kind === 'health'
            ? code === 200 ? 'connected' : 'disconnected'
            : code === 200 ? 'recovered' : 'deferred');
        const restartedDb = createIntegrationDatabaseModuleMock();
        expect((await readOmdbPacingReadiness(restartedDb)).wait).toBeGreaterThan(100);
        // Expire only the one-second fixture floor, not the provider's saved wait.
        await db.query("UPDATE omdb_request_pacing SET next_admission_at=clock_timestamp()-interval '1 second'");
        expect((await runner('health', restartedDb)(await config())).failure.code).toBe('provider_wait');
        expect(await runner('ssl', restartedDb)(await config())).toEqual({ status: 'deferred', code: 'paced' });
        expect((await reserveOmdbQuota(restartedDb, { pacing: true })).status).toBe('paced');
        expect(await credits()).toBe(1); expect(calls).toBe(1);
    });

    test.each([
        ['missing', undefined, 60], ['malformed', 'tomorrow', 60],
        ['oversized', 'x'.repeat(257), 60], ['capped', '9999999999', OMDB_MAX_WAIT_SECONDS],
        ['date', 'date', 120],
    ])('bounded %s wait is durable', async (_label, value, expected) => {
        header = value === 'date' ? new Date(Date.now() + 120_000).toUTCString() : value;
        await runner(kind)(await config());
        const { wait } = await readOmdbPacingReadiness(db);
        expect(wait).toBeGreaterThan(expected - 10); expect(wait).toBeLessThanOrEqual(expected);
        expect(await credits()).toBe(1); expect(calls).toBe(1);
    });

    test.each(['key', 'disabled', 'replacement'])('late %s change cannot acquire an old response wait', async change => {
        beforeResponse = async () => {
            if (change === 'key') await db.query("UPDATE omdb_config SET api_key='replacement fixture'");
            else if (change === 'disabled') await db.query('UPDATE omdb_config SET is_active=false');
            else await db.query(`INSERT INTO omdb_config(api_key,is_active,daily_limit,requests_today,last_reset_date)
                VALUES ('other fixture',true,1000,0,(clock_timestamp() AT TIME ZONE 'UTC')::date)`);
        };
        const saved = await config();
        await runner(kind)(saved);
        expect((await db.query('SELECT blocked_until FROM omdb_request_pacing')).rows[0].blocked_until).toBeNull();
        expect((await db.query('SELECT requests_today FROM omdb_config WHERE id=$1', [saved.id])).rows[0].requests_today).toBe(1);
        expect(calls).toBe(1);
    });

    test('does not shorten a longer matching wait saved while HTTP was in flight', async () => {
        beforeResponse = async () => deferOmdbPacing(db, providerCredentialContext('omdb', await config()), 300);
        await runner(kind)(await config());
        expect((await readOmdbPacingReadiness(db)).wait).toBeGreaterThan(280);
        expect(await credits()).toBe(1); expect(calls).toBe(1);
    });

    test('invalid advice on a non-rate-limited response does not create a provider cooldown', async () => {
        status = 200; header = 'tomorrow'; body = valid;
        await runner(kind)(await config());
        expect((await db.query('SELECT blocked_until FROM omdb_request_pacing')).rows[0].blocked_until).toBeNull();
        expect(await credits()).toBe(1); expect(calls).toBe(1);
    });

    test('persistence failure keeps credit and valid evidence without replaying HTTP', async () => {
        status = 200; body = valid;
        const observe = createOmdbPacingObserver({ database: {
            withTransaction: async () => { throw new Error('private fixture database failure'); },
        } });
        const result = await runner(kind, db, observe)(await config());
        expect(result.status).toBe(kind === 'health' ? 'connected' : 'recovered');
        expect((await db.query('SELECT blocked_until FROM omdb_request_pacing')).rows[0].blocked_until).toBeNull();
        expect(JSON.stringify(result)).not.toContain('private');
        expect(await credits()).toBe(1); expect(calls).toBe(1);
    });

    test('TLS recovery from a confirmed miss preserves wait without claiming healthy retrieval', async () => {
        status = 200; body = { Response: 'False', Error: 'Movie not found!' };
        const result = await runner(kind)(await config());
        expect(result.status).toBe(kind === 'health' ? 'unknown' : 'recovered');
        expect((await readOmdbPacingReadiness(db)).wait).toBeGreaterThan(100);
        expect(await credits()).toBe(1); expect(calls).toBe(1);
    });
});
