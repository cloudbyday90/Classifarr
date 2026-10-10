/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { httpGet } from '../utils/httpClient.mjs';
import { getTmdbIdentityAlternativeTitles } from '../services/tmdbIdentityAlternativeTitles.mjs';
import { verifyTmdbRecoveryTitle } from '../services/tmdbRecoveryTitleVerification.mjs';

const fixtureDeps = () => ({ getApiKey: jest.fn().mockResolvedValue('synthetic'),
  executeRateLimited: jest.fn(fn => fn()), httpGet: jest.fn().mockResolvedValue({ data: { id: 22, results: [] } }),
  baseUrl: 'https://fixture.invalid' });

test.each(['tv', 'movie'])('typed request is bounded and cancellation-aware: %s', async type => {
  const deps = fixtureDeps(); const signal = new AbortController().signal;
  expect(await getTmdbIdentityAlternativeTitles('22', type, deps, { signal })).toEqual({ id: 22, results: [] });
  expect(deps.httpGet).toHaveBeenCalledWith(`https://fixture.invalid/${type}/22/alternative_titles`, {
    params: { api_key: 'synthetic' }, timeout: 10000, maxResponseBytes: 1048576, redirect: 'error', signal,
  });
  expect(deps.executeRateLimited).toHaveBeenCalledWith(expect.any(Function), { signal });
});
test('invalid identifiers/types and missing credentials do not make HTTP requests', async () => {
  const deps = fixtureDeps();
  await expect(getTmdbIdentityAlternativeTitles('../22', 'tv', deps)).rejects.toThrow();
  expect(await getTmdbIdentityAlternativeTitles(22, 'person', deps)).toBeNull();
  expect(deps.getApiKey).not.toHaveBeenCalled();
  deps.getApiKey.mockResolvedValue(null);
  await expect(getTmdbIdentityAlternativeTitles(22, 'tv', deps)).rejects.toThrow('not configured');
  expect(deps.httpGet).not.toHaveBeenCalled();
});
test.each(['before', 'credentials', 'queue', 'response'])('cancellation at %s propagates', async stage => {
  const deps = fixtureDeps(); const controller = new AbortController();
  const failure = new Error('synthetic cancellation'); const cancel = () => controller.abort(failure);
  if (stage === 'before') cancel();
  if (stage === 'credentials') deps.getApiKey.mockImplementation(async () => { cancel(); return 'synthetic'; });
  if (stage === 'queue') deps.executeRateLimited.mockImplementation(async fn => { cancel(); return fn(); });
  if (stage === 'response') deps.httpGet.mockImplementation(async () => { cancel(); return { data: {} }; });
  await expect(getTmdbIdentityAlternativeTitles(22, 'tv', deps, { signal: controller.signal })).rejects.toBe(failure);
  if (stage !== 'response') expect(deps.httpGet).not.toHaveBeenCalled();
});

describe('real HTTP boundaries', () => {
  let server, deps, mode, requests, received;
  beforeAll(async () => {
    server = createServer((_req, res) => {
      requests++;
      received?.();
      if (mode === 'waiting') return;
      if (mode === 'redirect') { res.writeHead(302, { Location: '/not-followed' }); res.end(); return; }
      let body = JSON.stringify({ id: 22, results: [{ title: 'Fixture (US)' }] });
      if (mode === 'oversized') body = JSON.stringify({ private: 'x'.repeat(1048577) });
      if (mode === 'malformed') body = '{invalid';
      const compressed = gzipSync(body);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': compressed.length });
      res.end(compressed);
    });
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    deps = { getApiKey: async () => 'synthetic', executeRateLimited: fn => fn(), httpGet,
      baseUrl: `http://127.0.0.1:${server.address().port}` };
  });
  afterEach(() => { received = null; });
  afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); });
  test.each(['valid', 'oversized', 'malformed', 'redirect'])('handles %s without trusting unverified bodies', async scenario => {
    mode = scenario; requests = 0;
    const pending = verifyTmdbRecoveryTitle({ title: 'Fixture (US)', media_type: 'tv', year: 2001 }, 22,
      { id: 22, name: 'Fixture', first_air_date: '2001-01-01' },
      { getIdentityAlternativeTitles: (id, type, options) => getTmdbIdentityAlternativeTitles(id, type, deps, options) });
    if (mode === 'valid') expect(await pending).toEqual({ tmdbId: 22 });
    else if (mode === 'malformed') expect(await pending).toEqual({ tmdbId: null, reason: 'provider_response_invalid' });
    else await expect(pending).rejects.toThrow();
    expect(requests).toBe(1);
  });
  test('aborts an in-flight socket instead of waiting for its timeout', async () => {
    mode = 'waiting'; const controller = new AbortController();
    const arrival = new Promise(resolve => { received = resolve; });
    const pending = getTmdbIdentityAlternativeTitles(22, 'tv', deps, { signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow();
    await arrival; controller.abort(); await rejected;
  });
});
