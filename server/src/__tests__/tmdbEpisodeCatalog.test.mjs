/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createServer } from 'node:http';
import { httpGet } from '../utils/httpClient.mjs';
import { getTmdbIdentitySeasonDetails } from '../services/tmdbEpisodeCatalog.mjs';
import { catalogSeasonPlan, appendCatalogSeason } from '../services/catalogEpisodeEvidence.mjs';
import { createIdentityHttpFixture, withinIdentityTestDeadline } from './helpers/identityHttpFixture.mjs';

const deps = () => ({ getApiKey: jest.fn(async () => 'synthetic'), executeRateLimited: jest.fn(fn => fn()),
  httpGet: jest.fn(async () => ({ data: { id: 11, episodes: [] } })), baseUrl: 'https://fixture.invalid' });
test('uses a typed, bounded season request, including specials', async () => {
  const d = deps(), signal = new AbortController().signal;
  expect(await getTmdbIdentitySeasonDetails('10', 0, d, { signal })).toEqual({ id: 11, episodes: [] });
  expect(d.httpGet).toHaveBeenCalledWith('https://fixture.invalid/tv/10/season/0', {
    params: { api_key: 'synthetic' }, timeout: 10000, maxResponseBytes: 1048576, signal, redirect: 'error',
  });
  expect(d.executeRateLimited).toHaveBeenCalledWith(expect.any(Function), { signal });
});
test.each([['../10', 1], [0, 1], [10, -1], [10, 10001], [10, '1'], [10, null]])('invalid identifiers do no work', async (id, number) => {
  const d = deps();
  await expect(getTmdbIdentitySeasonDetails(id, number, d)).rejects.toThrow();
  expect(d.getApiKey).not.toHaveBeenCalled();
});
test('missing credentials never enter the request queue', async () => {
  const d = deps(); d.getApiKey.mockResolvedValue(null);
  await expect(getTmdbIdentitySeasonDetails(10, 1, d)).rejects.toThrow('not configured');
  expect(d.executeRateLimited).not.toHaveBeenCalled();
});
test.each(['before', 'credentials', 'queue', 'response'])('cancellation at %s propagates', async stage => {
  const d = deps(), controller = new AbortController(), failure = new Error('synthetic cancellation');
  const cancel = () => controller.abort(failure);
  if (stage === 'before') cancel();
  if (stage === 'credentials') d.getApiKey.mockImplementation(async () => { cancel(); return 'synthetic'; });
  if (stage === 'queue') d.executeRateLimited.mockImplementation(async fn => { cancel(); return fn(); });
  if (stage === 'response') d.httpGet.mockImplementation(async () => { cancel(); return { data: {} }; });
  await expect(getTmdbIdentitySeasonDetails(10, 1, d, { signal: controller.signal })).rejects.toBe(failure);
  if (stage !== 'response') expect(d.httpGet).not.toHaveBeenCalled();
});
test.each(['valid', 'malformed', 'oversized'])('real compressed transport: %s', async mode => {
  const payload = mode === 'valid' ? { id: 11, season_number: 1, episodes: [{ id: 100, show_id: 10, season_number: 1, episode_number: 1 }] }
    : mode === 'malformed' ? { id: 11, episodes: null } : { private: 'x'.repeat(1048577) };
  const f = await createIdentityHttpFixture(payload);
  try {
    const d = { ...deps(), httpGet, baseUrl: f.url };
    const pending = getTmdbIdentitySeasonDetails(10, 1, d);
    if (mode === 'oversized') await expect(withinIdentityTestDeadline(pending)).rejects.toThrow();
    else {
      const result = await withinIdentityTestDeadline(pending), target = new Map();
      const [plan] = catalogSeasonPlan(10, { id: 10, name: 'Synthetic', seasons: [{ id: 11, season_number: 1, episode_count: 1 }] });
      if (mode === 'malformed') expect(() => appendCatalogSeason(target, plan, result)).toThrow('catalog_invalid');
      else { appendCatalogSeason(target, plan, result); expect(target.size).toBe(1); }
    }
    expect(f.requests).toBe(1);
  } finally { await f.close(); }
});
test('real stalled response is aborted and disconnected', async () => {
  const f = await createIdentityHttpFixture(), controller = new AbortController();
  try {
    const pending = getTmdbIdentitySeasonDetails(10, 1, { ...deps(), httpGet, baseUrl: f.url }, { signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow();
    await withinIdentityTestDeadline(f.received); controller.abort();
    await withinIdentityTestDeadline(rejected); await withinIdentityTestDeadline(f.disconnected);
    expect(f.requests).toBe(1);
  } finally { await f.close(); }
});
test('real redirects cannot forward credentials to another path', async () => {
  let requests = 0;
  const server = createServer((_req, res) => { requests++; res.writeHead(302, { Location: '/not-followed' }); res.end(); });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  try {
    await expect(getTmdbIdentitySeasonDetails(10, 1, { ...deps(), httpGet,
      baseUrl: `http://127.0.0.1:${server.address().port}` })).rejects.toThrow();
    expect(requests).toBe(1);
  } finally { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); }
});
