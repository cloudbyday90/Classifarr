/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { verifyProviderRecovery } from '../services/providerRecoveryProbeTransport.mjs';
import { providerProbeDelay, normalizeProbeOutcome, providerProbeRetryHint } from '../services/providerRecoveryProbePolicy.mjs';
import { createProviderRecoveryProbeService } from '../services/providerRecoveryProbeService.mjs';

const query = 'Classifarr provider connectivity test';
const claim = provider_key => ({ provider_key, config: { api_key: 'fixture-secret', config: { projectId: 'fixture-project' } } });
test.each([
  ['omdb', { Response: 'True', Title: 'The Matrix', imdbID: 'tt0133093', Type: 'movie', Year: '1999' }],
  ['tavily', { query, results: [] }],
  ['brave', { type: 'search', query: { original: query }, web: { results: [] } }],
  ['serper', { searchParameters: { q: query }, organic: [] }],
])('%s requires live structured success and bounded no-redirect transport', async (provider, data) => {
  const request = jest.fn(async () => ({ status: 200, data }));
  expect(await verifyProviderRecovery(claim(provider), { get: request, post: request })).toEqual({ category: 'verified', retryAfterMs: 0 });
  expect(request).toHaveBeenCalledTimes(1);
  const args = request.mock.calls[0];
  expect(args[0]).toMatch(/^https:\/\//);
  expect(args.at(-1)).toMatchObject({ timeout: 5000, maxResponseBytes: 65536, redirect: 'error' });
  if (provider === 'tavily') {
    expect(args[1]).toMatchObject({ search_depth: 'basic', max_results: 1, include_answer: false });
    expect(args[2].headers['X-Project-ID']).toBe('fixture-project');
  }
});
test.each(['omdb', 'tavily', 'brave', 'serper'])('%s rejects malformed/unsuccessful bodies', async provider => {
  for (const data of [null, '<html>OK</html>', {}, { error: 'fixture-secret' }]) {
    const request = async () => ({ status: 200, data });
    const result = await verifyProviderRecovery(claim(provider), { get: request, post: request });
    expect(result.category).toBe('invalid_response'); expect(JSON.stringify(result)).not.toContain('fixture-secret');
  }
});
test.each([[401, 'rejected'], [403, 'rejected'], [429, 'rate_limited'], [402, 'quota_exhausted'], [503, 'unavailable']])(
  'HTTP %i never reopens credentials', async (status, category) => {
    const request = async () => { throw Object.assign(new Error('fixture-secret'), { response: { status, data: 'private body', headers: { 'retry-after': '3600' } } }); };
    expect(await verifyProviderRecovery(claim('tavily'), { post: request })).toEqual({ category, retryAfterMs: 3600000 });
  });
test('OMDb application errors and transport failures remain closed', async () => {
  for (const [data, category] of [[{ Response: 'False', Error: 'Invalid API key!' }, 'rejected'],
    [{ Response: 'False', Error: 'Request limit reached!' }, 'quota_exhausted']]) {
    expect((await verifyProviderRecovery(claim('omdb'), { get: async () => ({ status: 200, data }) })).category).toBe(category);
  }
  expect(await verifyProviderRecovery(claim('brave'), { get: async () => { throw new Error('fixture-secret'); } }))
    .toEqual({ category: 'unavailable', retryAfterMs: 0 });
});
test('unknown provider, missing key and forged success cannot authorize recovery', async () => {
  const request = jest.fn();
  expect(await verifyProviderRecovery(claim('unknown'), { get: request, post: request })).toEqual({ category: 'unavailable' });
  expect(await verifyProviderRecovery({ provider_key: 'omdb', config: {} }, { get: request })).toEqual({ category: 'unavailable' });
  expect(request).not.toHaveBeenCalled();
  expect(normalizeProbeOutcome({ verified: true, category: 'arbitrary' })).toMatchObject({ verified: false });
});
test('backoff is bounded, jittered and respects provider delay hints', () => {
  expect(providerProbeDelay(0, 0, () => 0)).toBe(900000);
  expect(providerProbeDelay(0, 0, () => 1)).toBe(1080000);
  expect(providerProbeDelay(10, 0, () => 1)).toBe(21600000);
  expect(providerProbeDelay(0, 86400000, () => 0)).toBe(86400000);
  expect(providerProbeDelay(0, Infinity, () => NaN)).toBe(900000);
});
test('HTTP delay hints preserve multi-day waits without accepting arbitrary header syntax', () => {
  expect(providerProbeRetryHint({ headers: { 'retry-after': '604800' } })).toBe(604800000);
  expect(providerProbeRetryHint({ headers: { 'retry-after': '9999999999' } })).toBe(30 * 86400000);
  const now = Date.parse('2026-09-29T00:00:00Z');
  expect(providerProbeRetryHint({ headers: { 'retry-after': 'Wed, 30 Sep 2026 00:00:00 GMT' } }, now)).toBe(86400000);
  for (const value of ['private', '1e6', '-20', '9000garbage', 'x'.repeat(129)]) {
    expect(providerProbeRetryHint({ headers: { 'retry-after': value, 'x-ratelimit-reset': value } })).toBe(0);
  }
});
test('coordinator coalesces local callers and sends at most one probe per wake-up', async () => {
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const repository = { candidates: jest.fn(async () => [{ id: 1 }, { id: 2 }]),
    claim: jest.fn(async candidate => ({ ...candidate, provider_key: 'omdb' })), finish: jest.fn(async () => true) };
  const verify = jest.fn(async () => { await barrier; return { category: 'verified' }; });
  const service = createProviderRecoveryProbeService({ repository, verify });
  const first = service.run(), second = service.run(); expect(first).toBe(second); release();
  expect(await first).toEqual({ checked: 1, recovered: 1 }); expect(verify).toHaveBeenCalledTimes(1);
});
test('no demand and database failures send no probe and expose no secrets', async () => {
  const verify = jest.fn(), logger = { debug: jest.fn() };
  const repository = { candidates: async () => [], claim: jest.fn() };
  const service = createProviderRecoveryProbeService({ repository, verify, logger });
  expect(await service.run()).toEqual({ checked: 0, recovered: 0 });
  repository.candidates = async () => { throw new Error('fixture-secret'); };
  expect(await service.run()).toMatchObject({ deferred: true });
  expect(verify).not.toHaveBeenCalled(); expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('fixture-secret');
});
test('stale success is not reported as recovery, transport rejection remains resumable', async () => {
  const repository = { candidates: async () => [{}], claim: async () => claim('omdb'), finish: jest.fn(async () => false) };
  const service = createProviderRecoveryProbeService({ repository, verify: async () => ({ category: 'verified' }) });
  expect(await service.run()).toEqual({ checked: 1, recovered: 0 });
  const failed = createProviderRecoveryProbeService({ repository, verify: async () => { throw new Error('secret'); } });
  await failed.run(); expect(repository.finish.mock.calls.at(-1)[1]).toEqual({ category: 'unavailable' });
});
