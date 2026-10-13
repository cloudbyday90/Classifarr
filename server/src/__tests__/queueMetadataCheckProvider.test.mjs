/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterEach, expect, jest, test } from '@jest/globals';
import { createQueueMetadataCheckProvider } from '../services/queueMetadataCheckProvider.mjs';
import { httpGet } from '../utils/httpClient.mjs';
import { createQueueMetadataCheckService } from '../services/queueMetadataCheckService.mjs';

let server;
afterEach(async () => {
  if (server) { const current = server; server = null; current.closeAllConnections(); await new Promise(resolve => { current.close(resolve); }); }
});

async function fixture(handler) {
  server = createServer(handler);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const calls = [];
  const read = createQueueMetadataCheckProvider({
    db: { query: async () => ({ rows: [{ id: 1, is_active: true, api_key: 'fixture-key' }] }) },
    executeRateLimited: (fn, { signal }) => { signal.throwIfAborted(); return fn(); },
    httpGet: (url, options) => { calls.push({ url, options }); return httpGet(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`, options); },
  });
  return { provider: await read(), calls };
}

test('uses the fixed typed endpoint, bounded real HTTP and no redirects', async () => {
  const { provider, calls } = await fixture((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"id":42,"title":"Fixture"}'); });
  const signal = new AbortController().signal;
  expect(await provider.getDetails(42, 'movie', signal)).toEqual({ id: 42, title: 'Fixture' });
  expect(calls[0].url).toBe('https://api.themoviedb.org/3/movie/42');
  expect(calls[0].options).toMatchObject({ signal, timeout: 10000, maxResponseBytes: 1048576, redirect: 'error' });
});
test.each([404, 401, 429, 503])('preserves real HTTP %s for safe service categorization', async status => {
  const { provider } = await fixture((_req, res) => { res.statusCode = status; res.end('private provider failure'); });
  await expect(provider.getDetails(42, 'tv', new AbortController().signal)).rejects.toMatchObject({ response: { status } });
});
test('rejects oversized bodies', async () => {
  const { provider } = await fixture((_req, res) => res.end('x'.repeat(1048577)));
  await expect(provider.getDetails(42, 'movie', new AbortController().signal)).rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE' });
});
test('does not follow an HTTP redirect', async () => {
  let received = 0;
  const { provider } = await fixture((_req, res) => { received++; res.writeHead(302, { location: '/redirected' }); res.end(); });
  await expect(provider.getDetails(42, 'movie', new AbortController().signal)).rejects.toBeDefined();
  expect(received).toBe(1);
});
test('cancels a real pending request', async () => {
  let admitted;
  const started = new Promise(resolve => { admitted = resolve; });
  const { provider } = await fixture(() => admitted());
  const controller = new AbortController();
  const pending = provider.getDetails(42, 'movie', controller.signal);
  const rejected = expect(pending).rejects.toBeDefined();
  await started; controller.abort(); await rejected;
});
test('configuration snapshots detect credential/enablement changes without exporting secrets', async () => {
  let config = { id: 1, is_active: true, api_key: 'one' };
  const http = jest.fn();
  const read = createQueueMetadataCheckProvider({ db: { query: async () => ({ rows: config ? [config] : [] }) },
    httpGet: http, executeRateLimited: fn => fn(), env: { TMDB_API_KEY: 'fallback' } });
  const first = await read(); config = { ...config, api_key: 'two' };
  expect((await read()).revision).not.toBe(first.revision);
  config.is_active = false;
  expect((await read()).configured).toBe(false);
  config = null;
  expect((await read()).configured).toBe(true);
  expect(JSON.stringify(first)).not.toContain('one');
  expect(http).not.toHaveBeenCalled();
});

test('external-ID and reverse lookups use fixed bounded endpoints', async () => {
  const { provider, calls } = await fixture((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{}'); });
  const signal = new AbortController().signal;
  await provider.findByExternalId('tt123', 'imdb_id', signal);
  await provider.findByExternalId(7, 'tvdb_id', signal);
  await provider.getExternalIds(99, 'tv', signal);
  expect(calls.map(call => call.url)).toEqual(['https://api.themoviedb.org/3/find/tt123',
    'https://api.themoviedb.org/3/find/7', 'https://api.themoviedb.org/3/tv/99/external_ids']);
  expect(calls[0].options.params.external_source).toBe('imdb_id');
  expect(calls[1].options.params.external_source).toBe('tvdb_id');
  for (const call of calls) expect(call.options).toMatchObject({ signal, timeout: 10000, maxResponseBytes: 1048576, redirect: 'error' });
});

test('invalid path/source values are rejected before transport', async () => {
  const { provider, calls } = await fixture((_req, res) => res.end('{}'));
  const signal = new AbortController().signal;
  await expect(provider.findByExternalId('../private', 'imdb_id', signal)).rejects.toMatchObject({ statusCode: 400 });
  await expect(provider.findByExternalId('tt123', 'url', signal)).rejects.toMatchObject({ statusCode: 400 });
  await expect(provider.getExternalIds(99, '../private', signal)).rejects.toMatchObject({ statusCode: 400 });
  await expect(provider.getDetails('../private', 'tv', signal)).rejects.toMatchObject({ statusCode: 400 });
  expect(calls).toHaveLength(0);
});

test('complete TV evidence uses exactly five real HTTP reads and one shared signal', async () => {
  const { provider, calls } = await fixture((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const path = new URL(req.url, 'http://fixture').pathname;
    if (path === '/3/tv/42') { res.statusCode = 404; res.end('{}'); }
    else if (path.startsWith('/3/find/')) res.end('{"tv_results":[{"id":99}]}');
    else if (path === '/3/tv/99') res.end('{"id":99,"name":"Candidate"}');
    else res.end('{"id":99,"imdb_id":"tt123","tvdb_id":7}');
  });
  const task = { revision: '1', task_type: 'classification', status: 'failed', current_stage: 'metadata_fetch',
    error_message: 'task_metadata_not_found', claim_token: null, routing_classification_id: null,
    tmdb_id: '42', media_type: 'tv', task_imdb_id: 'tt123', task_tvdb_id: 7,
    request_payload: { media: { tmdbId: '42', mediaType: 'tv', imdbId: 'tt123', tvdbId: 7 } } };
  const db = { query: async sql => ({ rows: [sql.includes('FROM users') ? { role: 'admin', is_active: true } : task] }) };
  const service = createQueueMetadataCheckService({ db, readProvider: async () => provider });
  expect(await service.check(1, '23', {})).toMatchObject({ observation: { category: 'not_found' },
    candidate: null, identityEvidence: { reason: 'candidate_for_review', candidate: { tmdbId: 99 } } });
  expect(calls).toHaveLength(5);
  expect(new Set(calls.map(call => call.options.signal)).size).toBe(1);
});

test.each(['findByExternalId', 'getExternalIds'])('cancels real follow-up request %s', async method => {
  let admitted;
  const started = new Promise(resolve => { admitted = resolve; });
  const { provider } = await fixture(() => admitted());
  const controller = new AbortController();
  const pending = method === 'findByExternalId'
    ? provider.findByExternalId('tt123', 'imdb_id', controller.signal)
    : provider.getExternalIds(99, 'tv', controller.signal);
  const rejected = expect(pending).rejects.toBeDefined();
  await started; controller.abort(); await rejected;
});
