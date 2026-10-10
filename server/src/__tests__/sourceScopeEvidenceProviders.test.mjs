/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createServer } from 'node:http';
import { createScopeCatalogProviderFactory } from '../services/sourceScopeEvidenceProviders.mjs';
import { createIdentityHttpFixture, withinIdentityTestDeadline } from './helpers/identityHttpFixture.mjs';

const service = baseUrl => ({ baseUrl, getApiKey: jest.fn(async () => 'synthetic'), executeRateLimited: jest.fn(fn => fn()) });
const read = (provider, kind, options = {}) => kind === 'details' ? provider.getIdentityDetails(10, 'movie', options)
  : kind === 'find' ? provider.findIdentityByExternalId('tt123', 'imdb_id', options) : provider.getIdentitySeasonDetails(10, 1, options);
test.each([null, '', 'changed'])('refuses missing or inconsistent catalog credentials: %s', async key => {
  const tmdb = service('http://fixture.invalid'); tmdb.getApiKey.mockResolvedValue(key);
  await expect(createScopeCatalogProviderFactory(tmdb)({ active: true, key: 'synthetic' })).rejects.toMatchObject({ statusCode: 503 });
  expect(tmdb.executeRateLimited).not.toHaveBeenCalled();
});
test('rejects disabled configuration before reading credentials', async () => {
  const tmdb = service('http://fixture.invalid');
  await expect(createScopeCatalogProviderFactory(tmdb)({ active: false, key: 'synthetic' })).rejects.toMatchObject({ statusCode: 503 });
  expect(tmdb.getApiKey).not.toHaveBeenCalled();
});
test.each(['key', 'url'])('detects catalog %s changes', async field => {
  const tmdb = service('http://fixture.invalid'), p = await createScopeCatalogProviderFactory(tmdb)(null);
  await p.recheck();
  if (field === 'key') tmdb.getApiKey.mockResolvedValue('changed');
  else tmdb.baseUrl = 'http://changed.invalid';
  await expect(p.recheck()).rejects.toMatchObject({ statusCode: 409 });
});
test.each(['details', 'season', 'find'])('real compressed %s read uses the bounded shared transport', async kind => {
  const body = { id: 10, title: 'Fixture', episodes: [] }, f = await createIdentityHttpFixture(body);
  try {
    const p = await createScopeCatalogProviderFactory(service(f.url))({ active: true, key: 'synthetic' });
    expect(await read(p, kind)).toEqual(body);
    expect(f.requests).toBe(1);
  } finally { await f.close(); }
});
test.each(['details', 'find'])('real oversized compressed %s response fails closed', async kind => {
  const f = await createIdentityHttpFixture({ private: 'x'.repeat(1048577) });
  try {
    const p = await createScopeCatalogProviderFactory(service(f.url))(null);
    await expect(withinIdentityTestDeadline(read(p, kind))).rejects.toThrow();
  } finally { await f.close(); }
});
test.each(['details', 'find'])('real stalled %s body disconnects on caller cancellation', async kind => {
  const f = await createIdentityHttpFixture(), controller = new AbortController();
  try {
    const p = await createScopeCatalogProviderFactory(service(f.url))(null);
    const rejected = expect(read(p, kind, { signal: controller.signal })).rejects.toThrow();
    await withinIdentityTestDeadline(f.received); controller.abort();
    await withinIdentityTestDeadline(rejected); await withinIdentityTestDeadline(f.disconnected);
    expect(f.requests).toBe(1);
  } finally { await f.close(); }
});
test.each(['details', 'find'])('real %s redirects never forward frozen credentials', async kind => {
  let requests = 0;
  const server = createServer((_req, res) => { requests++; res.writeHead(302, { Location: '/not-followed' }); res.end(); });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  try {
    const p = await createScopeCatalogProviderFactory(service(`http://127.0.0.1:${server.address().port}`))(null);
    await expect(read(p, kind)).rejects.toThrow();
    expect(requests).toBe(1);
  } finally { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); }
});
