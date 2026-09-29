/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { webSearchPacingDelay, observeWebSearchPacing } from '../services/webSearchPacingPolicy.mjs';
import { BraveProviderClient } from '../services/braveProviderClient.mjs';
import { TavilyProviderClient } from '../services/tavilyProviderClient.mjs';
import { SerperProviderClient } from '../services/serperProviderClient.mjs';
import { verifyProviderRecovery } from '../services/providerRecoveryProbeTransport.mjs';

const headers = { 'X-RateLimit-Limit': '1,15000', 'X-RateLimit-Remaining': '0,12000', 'X-RateLimit-Reset': '1,2000000' };
test('only exhausted Brave windows contribute; a remaining monthly allowance does not pause for a month', () => {
  expect(webSearchPacingDelay('brave', { status: 200, headers })).toBe(1);
  expect(webSearchPacingDelay('brave', { status: 429, headers })).toBe(1);
  expect(webSearchPacingDelay('brave', { headers: { ...headers, 'X-RateLimit-Remaining': '0,0' } })).toBe(2000000);
  expect(webSearchPacingDelay('brave', { headers: { ...headers, 'X-RateLimit-Limit': '1,0', 'X-RateLimit-Remaining': '0,0' } })).toBe(1);
  expect(webSearchPacingDelay('tavily', { headers })).toBe(0);
});
test.each(['-1', '1junk', '1e8', 'Infinity', '1.5', '9'.repeat(300), ['10'], null])('malformed retry hint %j is bounded', value => {
  expect(webSearchPacingDelay('brave', { status: 429, headers: { 'retry-after': value } })).toBe(60);
});
test('strict dates, Headers instances, bounded oversized delays and misaligned windows', () => {
  const now = Date.parse('2026-09-29T12:00:00Z');
  expect(webSearchPacingDelay('serper', { headers: new Headers({ 'Retry-After': 'Tue, 29 Sep 2026 12:02:00 GMT' }) }, now)).toBe(120);
  expect(webSearchPacingDelay('brave', { headers: { 'retry-after': '9999999999' } })).toBe(30 * 86400);
  expect(webSearchPacingDelay('brave', { headers: { ...headers, 'X-RateLimit-Remaining': '0' } })).toBe(0);
  expect(webSearchPacingDelay('brave', { headers: { ...headers, 'X-RateLimit-Reset': '1,bad' } })).toBe(0);
});
test.each(['brave', 'tavily', 'serper'])('%s captures successful and failed response hints without changing the body', async provider => {
  const http = jest.fn().mockResolvedValue({ status: 200, data: { fixture: true }, headers: { 'retry-after': '2' } });
  const clients = { brave: new BraveProviderClient({ httpGetFn: http }), tavily: new TavilyProviderClient({ httpPostFn: http }),
    serper: new SerperProviderClient({ httpPostFn: http }) };
  const observer = jest.fn();
  expect(await clients[provider].search('fixture', { apiKey: 'fixture-only', onPacingDelay: observer })).toEqual({ fixture: true });
  expect(observer).toHaveBeenLastCalledWith(2);
  http.mockRejectedValue({ response: { status: 429, headers: {}, data: {} } });
  await expect(clients[provider].search('fixture', { apiKey: 'fixture-only', onPacingDelay: observer })).rejects.toThrow();
  expect(observer).toHaveBeenLastCalledWith(60); expect(http).toHaveBeenCalledTimes(2);
});
test('observer failure does not repeat a paid request and probe timing uses matching windows', async () => {
  await expect(observeWebSearchPacing('brave', { status: 429 }, async () => { throw new Error('offline'); })).resolves.toBeUndefined();
  const outcome = await verifyProviderRecovery({ provider_key: 'brave', config: { api_key: 'fixture' } },
    { get: async () => ({ status: 429, headers }) });
  expect(outcome).toEqual({ category: 'rate_limited', retryAfterMs: 1000 });
});
