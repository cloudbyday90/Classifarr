/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';
import { createOmdbRecentLookup } from '../../services/omdbRecentLookup.mjs';
import { readRecentOmdbLookup } from '../../services/omdbRecentLookupRead.mjs';
import { createOmdbHealthAdmission } from '../../services/healthOmdbAdmission.mjs';
import { createMetadataHealthProbes } from '../../services/healthMetadataProbe.mjs';
import { createOmdbSslRecovery, createOmdbSslProbe } from '../../services/omdbSslRecovery.mjs';
import { readHealthProbeJson } from '../../services/healthProbeRequest.mjs';
import { httpGet } from '../../utils/httpClient.mjs';
import { getByIMDBId, getByTitle, search } from '../../services/omdbLookup.mjs';
import { reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';
import { deferOmdbPacing } from '../../services/omdbPacingStore.mjs';
import { providerCredentialContext } from '../../services/providerCredentialRejection.mjs';
import { QueueTaskProcessorService } from '../../services/queueTaskProcessorService.mjs';

const db = createIntegrationDatabaseModuleMock();
const config = async () => (await db.query('SELECT * FROM omdb_config WHERE is_active ORDER BY id DESC LIMIT 1')).rows[0];
const credits = async () => (await db.query('SELECT sum(requests_today)::int AS used FROM omdb_config')).rows[0].used;
const expireFloor = () => db.query("UPDATE omdb_request_pacing SET next_admission_at=clock_timestamp()-interval '1 second'");
const valid = { Response: 'True', Title: 'Fixture', imdbID: 'tt0133093', Type: 'movie' };
let recent, server, base, calls, body, status, requestFailure, wall, mono;
const context = async () => providerCredentialContext('omdb', await config());

function runner(kind, database = db, evidence = recent) {
    const readJson = (url, headers, options) => {
        expect(url).toBe('https://www.omdbapi.com/');
        return readHealthProbeJson(base, headers, options);
    };
    return kind === 'health'
        ? saved => createOmdbHealthAdmission({ db: database, recentLookup: evidence,
            probe: createMetadataHealthProbes({ readJson }).probeOmdbConnection })({}, saved)
        : createOmdbSslRecovery({ db: database, recentLookup: evidence, probe: createOmdbSslProbe({ readJson }) });
}
async function lookup(kind = 'id') {
    const deps = {
        baseUrl: 'https://www.omdbapi.com', recentLookup: recent, queueOwned: true,
        checkAndIncrementUsage: async () => {
            const admission = await reserveOmdbQuota(db, { pacing: true });
            if (admission.status !== 'reserved') throw new Error('fixture_admission_denied');
            return admission;
        },
        httpGet: (url, options) => { expect(url).toBe('https://www.omdbapi.com'); return httpGet(base, options); },
        shouldLogSslWarning: () => false, warnProviderRuntimeFailure: () => {},
    };
    if (kind === 'title') return getByTitle('Fixture', 1999, 'movie', null, deps);
    if (kind === 'search') return search('Fixture', 'movie', null, deps);
    return getByIMDBId('tt0133093', null, deps);
}

beforeEach(async () => {
    await seedOmdbQuotaFixture(db);
    calls = 0; status = 200; body = valid; requestFailure = null;
    wall = Date.now(); mono = 100;
    recent = createOmdbRecentLookup({ clock: () => wall, monotonic: () => mono });
    server = createServer((_req, res) => {
        calls++;
        // An independent connection can acquire the admission lock during HTTP.
        db.withTransaction(async client => {
            await client.query("SET LOCAL lock_timeout='100ms'");
            await client.query('LOCK TABLE omdb_config IN SHARE ROW EXCLUSIVE MODE');
        }).then(() => {
            res.statusCode = status; res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
        }).catch(error => { requestFailure = error; res.statusCode = 500; res.end('{}'); });
    });
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
    server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); });
    expect(requestFailure).toBeNull();
});

test.each(['id', 'title', 'search'])('%s lookup is reused without another request or credit; timestamps do not renew', async kind => {
    if (kind === 'search') body = { Response: 'True', Search: [valid], totalResults: '1' };
    await lookup(kind); await expireFloor();
    const evidence = recent.read(await context());
    wall += 10_000; mono += 10_000;
    for (let i = 0; i < 2; i++) {
        const health = await runner('health')(await config());
        expect(health).toMatchObject({ status: 'connected', lastCheck: evidence.lastCheck,
            lastSuccessfulCheck: evidence.lastCheck, responseTime: evidence.responseTime });
        expect(await runner('ssl')(await config())).toEqual({ status: 'recovered', code: 'transport_verified' });
    }
    expect(calls).toBe(1); expect(await credits()).toBe(1);
});

test.each(['health', 'ssl'])('%s fallback after expiration or reconstructed process uses admission', async kind => {
    await lookup(); await expireFloor(); wall += 60_000; mono += 60_000;
    expect((await runner(kind)(await config())).status).toBe(kind === 'health' ? 'connected' : 'recovered');
    expect(calls).toBe(2); expect(await credits()).toBe(2);
    await expireFloor();
    await runner(kind, db, createOmdbRecentLookup())(await config());
    expect(calls).toBe(3); expect(await credits()).toBe(3);
});

test('confirmed miss can recover SSL but cannot claim healthy retrieval', async () => {
    body = { Response: 'False', Error: 'Movie not found!' };
    expect(await lookup()).toBeNull(); await expireFloor();
    expect((await runner('ssl')(await config())).status).toBe('recovered');
    expect(calls).toBe(1);
    expect((await runner('health')(await config())).status).toBe('unknown');
    expect(calls).toBe(2); expect(await credits()).toBe(2);
});

describe.each(['health', 'ssl'])('%s reuse fencing', kind => {
    test.each(['key', 'disabled', 'replacement', 'rejected', 'budget', 'wait'])('saved %s change cannot be bypassed', async change => {
        await lookup(); await expireFloor(); const saved = await config();
        if (change === 'key') await db.query("UPDATE omdb_config SET api_key='replacement fixture'");
        if (change === 'disabled') await db.query('UPDATE omdb_config SET is_active=false');
        if (change === 'replacement') await db.query(`INSERT INTO omdb_config(api_key,is_active,daily_limit,requests_today,last_reset_date)
            VALUES ('other fixture',true,1000,0,(clock_timestamp() AT TIME ZONE 'UTC')::date)`);
        if (change === 'rejected') await db.query('UPDATE omdb_config SET credential_rejected_at=clock_timestamp()');
        if (change === 'budget') await db.query('UPDATE omdb_config SET daily_limit=1');
        if (change === 'wait') await deferOmdbPacing(db, await context(), 120);
        const result = await runner(kind)(saved);
        expect(result.status).toBe(kind === 'health' ? 'unknown' : 'deferred');
        expect(calls).toBe(1); expect(await credits()).toBe(1);
    });
    test('database failure cannot turn cached success into permission for HTTP', async () => {
        await lookup(); await expireFloor();
        const database = { withTransaction: async () => { throw new Error('private database detail'); } };
        const result = await runner(kind, database)(await config());
        expect(result.status).toBe(kind === 'health' ? 'unknown' : 'deferred');
        expect(JSON.stringify(result)).not.toContain('private'); expect(calls).toBe(1);
    });
});

test.each([429, 503, 200])('new HTTP %s failure retires earlier success', async code => {
    await lookup(); await expireFloor(); status = code; body = { invalid: true };
    await expect(lookup()).rejects.toThrow(); expect(recent.read(await context())).toBeNull();
    expect(calls).toBe(2); expect(await credits()).toBe(2);
});

test('new request while eligibility is being read cannot publish old success', async () => {
    await lookup(); await expireFloor(); const captured = await context();
    const database = { withTransaction: async fn => {
        const result = await db.withTransaction(fn);
        recent.begin(captured, 'https://www.omdbapi.com')();
        return result;
    } };
    expect(await readRecentOmdbLookup(database, recent, captured)).toBeNull();
    expect(calls).toBe(1); expect(await credits()).toBe(1);
});

test('a held configuration write lock times out reuse without HTTP or credit changes', async () => {
    await lookup(); await expireFloor(); const saved = await config();
    const writer = await getPool().connect();
    try {
        await writer.query('BEGIN');
        await writer.query('LOCK TABLE omdb_config IN ROW EXCLUSIVE MODE');
        const result = await runner('health')(saved);
        expect(result.failure.code).toBe('admission_unavailable');
        expect(calls).toBe(1); expect(await credits()).toBe(1);
    } finally { await writer.query('ROLLBACK'); writer.release(); }
});

test('a saved probe cannot seed reuse and blocks an overlapping lookup completion', async () => {
    await lookup(); await expireFloor(); const captured = await context();
    wall += 60_000; mono += 60_000;
    const check = createOmdbHealthAdmission({ db, recentLookup: recent, probe: async () => {
        recent.begin(captured, 'https://www.omdbapi.com')('success');
        return { success: false, code: 'authentication_failed' };
    } });
    expect((await check({}, await config())).status).toBe('disconnected');
    expect(recent.read(captured)).toBeNull();
    expect(await credits()).toBe(2); expect(calls).toBe(1);
});

test('queue pause invalidates old and in-flight success; reset and repeated SSL failure do too', async () => {
    await lookup(); await expireFloor(); const captured = await context();
    const processor = new QueueTaskProcessorService({ db, omdbRecentLookup: recent,
        logger: { info() {}, debug() {}, warn() {} },
        probeOmdbSslRecovery: async () => ({ status: 'ssl_error' }),
    });
    processor.queueOmdbEnrichmentService.setRuntimeState({ omdbSslBlockedUntil: Date.now() + 60_000 });
    expect(recent.read(captured)).toBeNull();
    const late = recent.begin(captured, 'https://www.omdbapi.com');
    processor.queueOmdbEnrichmentService.setRuntimeState({ omdbSslBlockedUntil: Date.now() + 60_000 });
    late('success'); expect(recent.read(captured)).toBeNull();
    await lookup(); await expireFloor();
    expect(await processor.isOmdbSslBlocked(await config())).toBe(true);
    expect(recent.read(captured)).toBeNull();
    await lookup(); processor.resetOmdbState(); expect(recent.read(captured)).toBeNull();
});
