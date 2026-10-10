/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readMediaSourceLayout } from '../services/mediaServers/shared/sourceLayout.mjs';
import { createIdentityHttpFixture, withinIdentityTestDeadline } from './helpers/identityHttpFixture.mjs';

const plexParent = { ratingKey: 'show', librarySectionID: 'library', type: 'show', title: 'Synthetic',
  year: 2020, Guid: [{ id: 'tmdb://10' }] };
const plexEpisode = { ratingKey: 'episode', type: 'episode', grandparentRatingKey: 'show',
  parentIndex: 1, index: 1 };
const embyParent = { Id: 'show', ParentId: 'library', Type: 'Series', Name: 'Synthetic',
  ProductionYear: 2020, ProviderIds: { Tmdb: '10' } };
const embyEpisode = { Id: 'episode', Type: 'Episode', SeriesId: 'show', ParentIndexNumber: 1, IndexNumber: 1 };

async function fixture(kind, { parent, episode, page = {}, redirect = false } = {}) {
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture');
    requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), headers: request.headers });
    if (redirect) { response.writeHead(302, { Location: '/should-not-follow' }); response.end(); return; }
    const first = requests.length === 1;
    const body = kind === 'plex'
      ? { MediaContainer: first ? { Metadata: [parent ?? plexParent] } :
        { offset: 0, totalSize: 1, size: 1, Metadata: [episode ?? plexEpisode], ...page } }
      : first ? parent ?? embyParent : { StartIndex: 0, TotalRecordCount: 1, Items: [episode ?? embyEpisode], ...page };
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
    response.end(gzipSync(JSON.stringify(body)));
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, requests,
    close: async () => { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); } };
}

test.each(['plex', 'emby'])('real HTTP captures bounded normalized membership: %s', async kind => {
  const f = await fixture(kind);
  try {
    const result = await withinIdentityTestDeadline(readMediaSourceLayout(kind, f.url, 'synthetic-token', 'library', 'show'));
    expect(result).toMatchObject({ identity: { mediaType: 'tv', providerIds: { tmdb_id: [10] } },
      episodeCount: 1, seasons: [{ number: 1, episodes: [1] }] });
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(f.requests).toHaveLength(2);
    expect(f.requests[1].query).toMatchObject(kind === 'plex'
      ? { 'X-Plex-Container-Start': '0', 'X-Plex-Container-Size': '100' }
      : { ParentId: 'show', IncludeItemTypes: 'Episode', StartIndex: '0', Limit: '100', Recursive: 'true' });
    expect(f.requests[0].headers[kind === 'plex' ? 'x-plex-token' : 'x-emby-token']).toBe('synthetic-token');
    expect(JSON.stringify(result)).not.toMatch(/Synthetic|token|http|library/u);
  } finally { await f.close(); }
});

test.each([
  ['plex', { parent: { ...plexParent, librarySectionID: 'elsewhere' } }],
  ['plex', { parent: { ...plexParent, type: 'season' } }],
  ['plex', { episode: { ...plexEpisode, grandparentRatingKey: 'other' } }],
  ['plex', { episode: { ...plexEpisode, librarySectionID: 'elsewhere' } }],
  ['plex', { page: { totalSize: undefined } }],
  ['plex', { page: { offset: 1 } }],
  ['emby', { parent: { ...embyParent, ParentId: 'elsewhere' } }],
  ['emby', { episode: { ...embyEpisode, SeriesId: 'other' } }],
  ['emby', { episode: { ...embyEpisode, Type: 'Movie' } }],
  ['emby', { episode: { ...embyEpisode, IndexNumberEnd: 2 } }],
  ['emby', { page: { TotalRecordCount: undefined } }],
])('real transport refuses ambiguous or mismatched provider evidence', async (kind, data) => {
  const f = await fixture(kind, data);
  try {
    await expect(withinIdentityTestDeadline(readMediaSourceLayout(kind, f.url, 'synthetic', 'library', 'show')))
      .rejects.toThrow('source_layout_invalid');
  } finally { await f.close(); }
});

test('source credentials are not redirected to another path or origin', async () => {
  const f = await fixture('plex', { redirect: true });
  try {
    await expect(readMediaSourceLayout('plex', f.url, 'synthetic', 'library', 'show')).rejects.toThrow('source_layout_unavailable');
    expect(f.requests).toHaveLength(1);
  } finally { await f.close(); }
});

test('real compressed body limit rejects excessive provider response', async () => {
  const f = await createIdentityHttpFixture({ private: 'secret'.repeat(200000) });
  try {
    await expect(withinIdentityTestDeadline(readMediaSourceLayout('plex', f.url, 'synthetic', 'library', 'show')))
      .rejects.toThrow('source_layout_unavailable');
    expect(f.requests).toBe(1);
  } finally { await f.close(); }
});

test('cancellation closes a real stalled response without another request', async () => {
  const f = await createIdentityHttpFixture();
  try {
    const controller = new AbortController();
    const pending = readMediaSourceLayout('plex', f.url, 'synthetic', 'library', 'show', { signal: controller.signal });
    const assertion = expect(pending).rejects.toThrow();
    await withinIdentityTestDeadline(f.received);
    controller.abort();
    await withinIdentityTestDeadline(assertion);
    await withinIdentityTestDeadline(f.disconnected);
    expect(f.requests).toBe(1);
  } finally { await f.close(); }
});

test.each(['.', '..', '', 'x\n', 'x'.repeat(501)])('invalid source keys cause no HTTP: %s', async key => {
  await expect(readMediaSourceLayout('plex', 'http://unreachable.invalid', 'synthetic', 'library', key))
    .rejects.toThrow('source_layout_invalid');
});
