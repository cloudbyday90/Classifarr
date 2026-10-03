/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { ArrLookupFailure, parseArrRetryAfter, routingProviderFailure } from '../services/arrLookupFailure.mjs';
import { radarrService } from '../services/radarr.mjs';
import { sonarrService } from '../services/sonarr.mjs';

test.each([[null, null], ['', null], ['bad', null], ['-1', null], ['1.5', null], ['1e3', null],
  ['120', 120], ['0', 0], ['9999999999999999999999999', 86401], ['x'.repeat(129), null]])(
  'Retry-After %s is parsed without accepting arbitrary values', (value, expected) => {
    expect(parseArrRetryAfter(value)).toBe(expected);
  });
test('HTTP date supports future and past, and long delays never shorten to an automatic retry', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  expect(parseArrRetryAfter('Sat, 03 Oct 2026 12:02:00 GMT', now)).toBe(120);
  expect(parseArrRetryAfter('Saturday, 03-Oct-26 12:02:00 GMT', now)).toBe(120);
  expect(parseArrRetryAfter('Sat Oct  3 12:02:00 2026', now)).toBe(120);
  expect(parseArrRetryAfter('Sat, 03 Oct 2026 11:59:00 GMT', now)).toBe(0);
  expect(parseArrRetryAfter('Sat, 03 Oct 2026 99:99:00 GMT', now)).toBeNull();
  expect(new ArrLookupFailure('safe', { response: { status: 429, headers: { 'retry-after': '86401' } } }).kind).toBe('configuration');
});
test.each([['ECONNREFUSED', 'transient'], ['ETIMEDOUT', 'transient'], ['EAI_AGAIN', 'transient'],
  ['CERT_HAS_EXPIRED', 'configuration'], ['ERR_HTTP_RESPONSE_TOO_LARGE', 'configuration']])(
  'transport %s maps to %s without retaining the raw error', (code, kind) => {
    const error = new ArrLookupFailure('safe', { code, message: 'private-key', cause: new Error('private-url') });
    expect(error.kind).toBe(kind);
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('private');
  });
test('unknown adapter failures remain unavailable, not proof of absence', () => {
  expect(routingProviderFailure(new Error('private'))).toEqual({ kind: 'transient', retryAfterSeconds: null });
});

describe.each([[radarrService, 'getMovieByTmdbId'], [sonarrService, 'getSeriesByTvdbId']])(
  'provider %s real HTTP failure categories', (provider, lookup) => {
    test.each([[401, 'authentication'], [403, 'authentication'], [404, 'configuration'], [400, 'configuration'],
      [408, 'transient'], [429, 'transient'], [500, 'transient'], [503, 'transient'], [501, 'configuration'],
      [200, 'configuration']])('%s -> %s with one GET only', async (status, kind) => {
      const requests = [];
      const server = createServer((request, response) => {
        requests.push(request.method);
        response.writeHead(status, { 'Content-Type': 'application/json', 'Retry-After': '900' });
        response.end('{"private":"credential-and-url"}'); // 200 is deliberately not an item list.
      });
      try {
        server.listen(0, '127.0.0.1'); await once(server, 'listening');
        let failure;
        try { await provider[lookup](`http://127.0.0.1:${server.address().port}`, 'synthetic-key', 42); }
        catch (error) { failure = error; }
        expect(failure).toBeInstanceOf(ArrLookupFailure);
        expect(failure.kind).toBe(kind);
        expect(failure.retryAfterSeconds).toBe([429, 503].includes(status) ? 900 : null);
        expect(JSON.stringify(failure)).not.toMatch(/private|credential|synthetic|127\.0\.0\.1/);
        expect(requests).toEqual(['GET']);
      } finally { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); }
    });
  });
