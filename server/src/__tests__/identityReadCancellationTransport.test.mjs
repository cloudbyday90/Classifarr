/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { plexService } from '../services/mediaServers/plex.mjs';
import { jellyfinService } from '../services/mediaServers/jellyfin.mjs';
import { embyService } from '../services/mediaServers/emby.mjs';
import { tmdbService } from '../services/tmdb.mjs';
import { RateLimiter } from '../utils/rateLimiter.mjs';
import { createIdentityHttpFixture, withinIdentityTestDeadline as within } from './helpers/identityHttpFixture.mjs';

function readers(url) {
  // A per-test receiver preserves the actual facade without modifying its singleton.
  const tmdb = Object.create(tmdbService);
  tmdb.baseUrl = url; tmdb.getApiKey = async () => 'synthetic-only';
  tmdb.rateLimiters = { tmdb: new RateLimiter() };
  return {
    find: signal => tmdb.findIdentityByExternalId('tt123', 'imdb_id', { signal }),
    details: signal => tmdb.getIdentityDetails(22, 'movie', { signal }),
    ...Object.fromEntries(Object.entries({ plex: plexService, jellyfin: jellyfinService, emby: embyService })
      .map(([name, service]) => [name, signal => service.getLibraryItemIdentityEvidence(url, 'synthetic-only', '1', '22', { signal })])),
  };
}

test.each(['find', 'details', 'plex', 'jellyfin', 'emby'])
('real %s identity read cancels a stalled body and closes the response', async name => {
  const fixture = await createIdentityHttpFixture(); const controller = new AbortController();
  try {
    const outcome = readers(fixture.url)[name](controller.signal).then(value => ({ value }), error => ({ error }));
    await within(fixture.received);
    controller.abort(new Error('synthetic owner lost'));
    expect((await within(outcome)).error).toBeInstanceOf(Error);
    await within(fixture.disconnected);
    expect(fixture.requests).toBe(1);
  } finally { controller.abort(); await fixture.close(); }
});

test.each(['find', 'details', 'plex', 'jellyfin', 'emby'])
('pre-cancelled %s sends nothing and oversized decoded bodies fail closed', async name => {
  const fixture = await createIdentityHttpFixture({ private: 'x'.repeat(1048576) });
  try {
    await expect(readers(fixture.url)[name](AbortSignal.abort())).rejects.toThrow();
    expect(fixture.requests).toBe(0);
    await expect(readers(fixture.url)[name]()).rejects.toThrow();
    expect(fixture.requests).toBe(1);
  } finally { await fixture.close(); }
});

test.each(['findIdentityByExternalId', 'getIdentityDetails'])
('actual TMDb facade cancels rate admission before network I/O: %s', async method => {
  const fixture = await createIdentityHttpFixture(); const controller = new AbortController();
  const tmdb = Object.create(tmdbService); const limiter = new RateLimiter({ maxRequests: 1, intervalMs: 60000 });
  tmdb.baseUrl = fixture.url; tmdb.getApiKey = async () => 'synthetic-only'; tmdb.rateLimiters = { tmdb: limiter };
  const acquired = Promise.withResolvers();
  const acquire = limiter.acquire.bind(limiter);
  jest.spyOn(limiter, 'acquire').mockImplementation(options => { const result = acquire(options); acquired.resolve(); return result; });
  limiter.tokens = 0;
  try {
    const args = method === 'findIdentityByExternalId' ? ['tt123', 'imdb_id'] : [22, 'movie'];
    const outcome = tmdb[method](...args, { signal: controller.signal }).then(value => ({ value }), error => ({ error }));
    await within(acquired.promise);
    controller.abort(new Error('synthetic stop'));
    expect((await within(outcome)).error.message).toBe('synthetic stop');
    expect(fixture.requests).toBe(0);
  } finally { controller.abort(); jest.restoreAllMocks(); await fixture.close(); }
});
