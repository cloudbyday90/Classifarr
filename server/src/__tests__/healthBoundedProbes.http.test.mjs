/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { probeRadarrConnection, probeSonarrConnection } from '../services/healthArrProbe.mjs';
import { createMetadataHealthProbes } from '../services/healthMetadataProbe.mjs';
import { readHealthProbeJson } from '../services/healthProbeRequest.mjs';
import { measureConnectionProbe, buildConnectionProbeHealthState } from '../services/healthConnectionProbe.mjs';

const previous = { status: 'connected', lastSuccessfulCheck: '2026-10-01T00:00:00Z' };
const validTmdb = { images: { base_url: 'http://images.invalid/', secure_base_url: 'https://images.invalid/', poster_sizes: ['original'] }, change_keys: ['title'] };
const validOmdb = { Response: 'True', Title: 'Fixture', imdbID: 'tt0133093', Type: 'movie' };
let server, base, handler, calls, probes;

beforeEach(async () => {
    calls = [];
    handler = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{}'); };
    server = createServer((req, res) => { calls.push(req); handler(req, res); });
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
    probes = createMetadataHealthProbes({ readJson: (url, headers, options) => {
        expect(['https://api.themoviedb.org/3/configuration', 'https://www.omdbapi.com/']).toContain(url);
        return readHealthProbeJson(base, headers, options);
    } });
});
afterEach(async () => {
    server.closeAllConnections();
    await new Promise(resolve => { server.close(resolve); });
});

function respond(data, status = 200) {
    handler = (_req, res) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
}
const observe = async probe => buildConnectionProbeHealthState(previous, await measureConnectionProbe(probe));
function config(extra = {}) { return { url: `${base}/prefix/`, api_key: 'synthetic-key', ...extra }; }

describe.each([['Radarr', probeRadarrConnection], ['Sonarr', probeSonarrConnection]])('%s health', (appName, probe) => {
    test.each([true, false])('one authenticated status read, including legacy=%s', async legacy => {
        respond(legacy ? { version: '3.0.1', isProduction: true } : { version: '6.0.1', appName });
        expect((await observe(() => probe(config()))).status).toBe('connected');
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('/prefix/api/v3/system/status');
        expect(calls[0].headers['x-api-key']).toBe('synthetic-key');
        expect(calls[0].headers.accept).toBe('application/json');
    });
    test('legacy host/port/base path and explicit URL precedence remain supported', async () => {
        respond({ appName, version: '1.2.3' });
        const saved = { host: '127.0.0.1', port: server.address().port, base_path: 'legacy', api_key: 'synthetic' };
        expect((await probe(saved)).success).toBe(true);
        expect(calls[0].url).toBe('/legacy/api/v3/system/status');
        expect((await probe({ ...saved, url: base })).success).toBe(true);
        expect(calls[1].url).toBe('/api/v3/system/status');
    });
    test.each([{}, [], 'html', { version: '1' }, { version: '', appName: 'Radarr' },
        { version: '1', appName: 'wrong-app' }, { version: '1', isProduction: 'true' }])('malformed status is unknown: %j', async data => {
        respond(data);
        expect((await observe(() => probe(config()))).failure.code).toBe('response_invalid');
    });
    test.each(['ftp://fixture', 'http://key:secret@fixture', 'http://fixture/?key=secret', 'http://fixture/#secret'])('rejects invalid endpoint without traffic: %s', async url => {
        const result = await observe(() => probe(config({ url })));
        expect(result.status).toBe('unknown');
        expect(result.failure.code).toBe('configuration_invalid');
        expect(calls).toHaveLength(0);
    });
    test('missing key is unknown without a request', async () => {
        expect((await observe(() => probe(config({ api_key: ' ' })))).status).toBe('unknown');
        expect(calls).toHaveLength(0);
    });
    test('redirect cannot forward the API-key header', async () => {
        handler = (_req, res) => { res.writeHead(302, { Location: `${base}/must-not-reach` }); res.end(); };
        expect((await observe(() => probe(config()))).status).toBe('disconnected');
        expect(calls).toHaveLength(1);
    });
    test('oversized status body is unknown', async () => {
        respond({ data: 'x'.repeat(1_048_576) });
        expect((await observe(() => probe(config()))).failure.code).toBe('response_too_large');
    });
    test('shorter saved deadline cancels a stalled body', async () => {
        let closed;
        const disconnected = new Promise(resolve => { closed = resolve; });
        handler = (_req, res) => { res.once('close', closed); res.writeHead(200); res.write('{'); };
        const result = await observe(() => probe(config({ timeout: 0.1 })));
        await disconnected;
        expect(result.failure.code).toBe('connection_timeout');
        expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
        expect(calls).toHaveLength(1);
    });
});

describe.each(['tmdb', 'omdb'])('%s health', provider => {
    const probe = () => provider === 'tmdb' ? probes.probeTmdbConnection('synthetic-key') : probes.probeOmdbConnection('synthetic-key');
    test('valid payload proves a single bounded lookup', async () => {
        respond(provider === 'tmdb' ? validTmdb : validOmdb);
        expect((await observe(probe)).status).toBe('connected');
        expect(calls).toHaveLength(1);
        const url = new URL(calls[0].url, base);
        expect(url.searchParams.get(provider === 'tmdb' ? 'api_key' : 'apikey')).toBe('synthetic-key');
        if (provider === 'omdb') {
            expect(url.searchParams.get('t')).toBe('The Matrix');
            expect(url.searchParams.get('y')).toBe('1999');
        }
    });
    test.each([{}, [], 'private-html', null])('malformed data is unknown: %j', async data => {
        respond(data);
        const result = await observe(probe);
        expect(result.status).toBe('unknown');
        expect(result.failure.code).toBe('response_invalid');
        expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
        expect(JSON.stringify(result)).not.toMatch(/synthetic-key|private-html|127\.0\.0\.1/);
    });
    test('HTTP 204 is not success', async () => {
        respond(null, 204);
        expect((await observe(probe)).status).toBe('unknown');
    });
    test.each([[401, 'authentication_failed'], [403, 'authentication_failed'], [429, 'rate_limited'], [500, 'connection_failed']])('HTTP %i keeps a safe failure code', async (status, code) => {
        respond({ private: 'private-provider-text' }, status);
        const result = await observe(probe);
        expect(result.status).toBe('disconnected');
        expect(result.failure.code).toBe(code);
        expect(JSON.stringify(result)).not.toContain('private-provider-text');
    });
    test('redirect never forwards query credentials', async () => {
        handler = (_req, res) => { res.writeHead(302, { Location: `${base}/must-not-reach` }); res.end(); };
        expect((await observe(probe)).status).toBe('disconnected');
        expect(calls).toHaveLength(1);
    });
    test('compressed oversized body is unknown', async () => {
        handler = (_req, res) => {
            res.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Type': 'application/json' });
            res.end(gzipSync(JSON.stringify({ data: 'x'.repeat(1_048_576) })));
        };
        expect((await observe(probe)).failure.code).toBe('response_too_large');
    });
});

test.each([[200, 'Invalid API key!', 'authentication_failed'], [200, 'Request limit reached!', 'quota_exhausted'],
    [401, 'Request limit reached!', 'quota_exhausted'], [429, 'Daily limit reached!', 'quota_exhausted'],
    [200, 'Movie not found!', 'response_invalid'], [200, 'private unrecognized text', 'connection_failed']])('OMDb body failure %i/%s is classified without text disclosure', async (status, Error, code) => {
    respond({ Response: 'False', Error }, status);
    const result = await observe(() => probes.probeOmdbConnection('synthetic'));
    expect(result.failure.code).toBe(code);
    expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
    expect(JSON.stringify(result)).not.toContain(Error);
});

test.each([{ ...validTmdb, success: false }, { images: {} }, { ...validTmdb, change_keys: 'title' },
    { ...validTmdb, images: { ...validTmdb.images, poster_sizes: [] } }])('TMDb requires configuration shape: %j', async data => {
    respond(data);
    expect((await observe(() => probes.probeTmdbConnection('synthetic'))).status).toBe('unknown');
});

test('TMDb body consumption is cancelled at its five-second deadline', async () => {
    let closed;
    const disconnected = new Promise(resolve => { closed = resolve; });
    handler = (_req, res) => { res.once('close', closed); res.writeHead(200); res.write('{'); };
    const result = await observe(() => probes.probeTmdbConnection('synthetic'));
    await disconnected;
    expect(result.failure.code).toBe('connection_timeout');
    expect(result.responseTime).toBeGreaterThanOrEqual(4900);
    expect(calls).toHaveLength(1);
}, 10_000);
