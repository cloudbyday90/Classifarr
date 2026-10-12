/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { createNamedMockModule, createLoggerModuleMock } from './helpers/mockFactory.mjs';

const db = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));
jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);
const { checkOllama } = await import('../services/healthCheckAiProvider.mjs');
const { checkMediaServer } = await import('../services/healthCheckMediaServer.mjs');
const { checkRadarr, checkSonarr } = await import('../services/healthCheckArrServices.mjs');
const { createHealthObservationCoordinator } = await import('../services/healthObservationCoordinator.mjs');

let server, base, handler, calls;
const previous = { status: 'connected', lastSuccessfulCheck: '2026-10-01T00:00:00.000Z' };
beforeEach(async () => {
    calls = [];
    handler = (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ MediaContainer: { machineIdentifier: 'fixture', version: '1' }, Id: 'fixture', Version: '1', models: [] }));
    };
    server = createServer((request, response) => { calls.push({ url: request.url, headers: request.headers }); handler(request, response); });
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
    db.query.mockReset();
});
afterEach(async () => {
    server.closeAllConnections();
    await new Promise(resolve => { server.close(resolve); });
});

function media(type = 'plex', extra = {}) {
    return { id: 1, type, name: 'Fixture', url: `${base}/prefix/`, api_key: 'synthetic-key', client_identifier: 'synthetic-client', ...extra };
}
function configure(row) { db.query.mockResolvedValue({ rows: [row] }); }

test.each(['plex', 'emby', 'jellyfin'])('%s reads authenticated info using the current saved key', async type => {
    configure(media(type));
    expect((await checkMediaServer(previous)).status).toBe('connected');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(type === 'plex' ? '/prefix/' : '/prefix/System/Info');
    expect(calls[0].headers.accept).toBe('application/json');
    expect(calls[0].headers[type === 'plex' ? 'x-plex-token' : 'x-emby-token']).toBe('synthetic-key');
    expect(calls[0].url).not.toContain('synthetic-key');
});

test('Ollama lists models without generation and ignores obsolete URL', async () => {
    configure({ primary_provider: 'ollama', ollama_host: '127.0.0.1', ollama_port: server.address().port, ollama_url: 'http://must-not-use.invalid' });
    const result = await checkOllama(previous);
    expect(result.status).toBe('connected');
    expect(calls.map(call => call.url)).toEqual(['/api/tags']);
});

test.each([401, 403, 429, 500])('HTTP %s cannot become healthy or disclose its body', async status => {
    configure(media());
    handler = (_request, response) => { response.writeHead(status); response.end('private-provider-body'); };
    const result = await checkMediaServer(previous);
    expect(result.status).toBe('disconnected');
    expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
    expect(JSON.stringify(result)).not.toMatch(/synthetic-key|private-provider-body|127\.0\.0\.1/);
});

test.each([{}, { MediaContainer: {} }, '<html>login</html>'])('HTTP 200 with malformed media identity remains unknown: %j', async body => {
    configure(media());
    handler = (_request, response) => response.end(JSON.stringify(body));
    expect((await checkMediaServer(previous)).failure.code).toBe('response_invalid');
});

test('invalid Ollama payload does not claim success', async () => {
    configure({ primary_provider: 'ollama', ollama_host: '127.0.0.1', ollama_port: server.address().port });
    handler = (_request, response) => response.end('{}');
    expect((await checkOllama(previous)).status).toBe('unknown');
});

test('redirects never forward the saved credential', async () => {
    configure(media());
    handler = (_request, response) => { response.writeHead(302, { Location: `${base}/credential-recipient` }); response.end(); };
    expect((await checkMediaServer(previous)).status).toBe('disconnected');
    expect(calls).toHaveLength(1);
});

test('decoded compressed responses have a size bound', async () => {
    configure(media());
    handler = (_request, response) => {
        response.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Type': 'application/json' });
        response.end(gzipSync(JSON.stringify({ private: 'x'.repeat(1_048_576) })));
    };
    expect((await checkMediaServer(previous)).failure.code).toBe('response_too_large');
});

test('response-body stalls are cancelled by the actual deadline', async () => {
    configure(media());
    let closed;
    const disconnected = new Promise(resolve => { closed = resolve; });
    handler = (_request, response) => { response.once('close', closed); response.writeHead(200); response.write('{'); };
    const result = await checkMediaServer(previous);
    await disconnected;
    expect(result.status).toBe('disconnected');
    expect(result.error).toContain('did not respond in time');
    expect(result.responseTime).toBeGreaterThanOrEqual(9_900);
    expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
}, 15_000);

test.each(['ftp://fixture', 'http://user:secret@fixture', 'http://fixture/?key=secret', 'http://fixture/#secret'])('invalid saved endpoint is rejected without traffic: %s', async url => {
    configure(media('plex', { url }));
    expect((await checkMediaServer(previous)).failure.code).toBe('endpoint_invalid');
    expect(calls).toHaveLength(0);
});

test.each([['unsupported', 'synthetic-key', 'unknown'], ['plex', null, 'not configured']])('unprobeable media configuration is not healthy', async (type, api_key, status) => {
    configure(media(type, { api_key }));
    expect((await checkMediaServer(previous)).status).toBe(status);
    expect(calls).toHaveLength(0);
});

test.each([checkRadarr, checkSonarr])('real Arr helper returned failure remains disconnected', async check => {
    configure({ id: 1, name: 'Fixture', url: base, api_key: 'synthetic-key', timeout: 1 });
    handler = (_request, response) => { response.writeHead(401); response.end('{"message":"private-token"}'); };
    const result = await check(previous);
    expect(result.status).toBe('disconnected');
    expect(result.instances[0].status).toBe('disconnected');
    expect(result.lastSuccessfulCheck).toBe(previous.lastSuccessfulCheck);
    expect(JSON.stringify(result)).not.toContain('private-token');
    expect(calls).toHaveLength(1);
});

test.each(['mediaServer', 'ollama'])('%s discards a success when settings change during real HTTP', async service => {
    let rows = [service === 'mediaServer' ? media() : { primary_provider: 'ollama', ollama_host: '127.0.0.1', ollama_port: server.address().port }];
    db.query.mockImplementation(async () => ({ rows }));
    const normal = handler;
    handler = (request, response) => { rows = []; normal(request, response); };
    const coordinator = createHealthObservationCoordinator();
    const result = await coordinator.run(service, service === 'mediaServer' ? checkMediaServer : checkOllama);
    expect(result.status).toBe('unknown');
    expect(result.failure.code).toBe('configuration_changed');
    expect(result.lastSuccessfulCheck).toBeNull();
    expect(calls).toHaveLength(1);
});
