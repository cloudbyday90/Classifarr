/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { boundedJson, fixtureSession, startRoutingProvider } from '../../scripts/embeddedIsolationDrill/httpRoutingTransport.mjs';
import { readHttpRouting, waitForHttpRouting, seedHttpRouting, routingCases } from '../../scripts/embeddedIsolationDrill/httpRoutingState.mjs';

const rows = () => routingCases.map((item, i) => ({ id: String(i + 1), tmdb_id: item.tmdbId, media_type: item.type,
  title: item.title, method: 'policy_auto', status: 'routed', external_id: `isolation-http-${item.type}`,
  routing: 'routed', verified: 'true' }));

test('bounded JSON stops oversized streams and rejects malformed responses', async () => {
  await expect(boundedJson([Buffer.from('{"ok":true}')])).resolves.toEqual({ ok: true });
  await expect(boundedJson([Buffer.alloc(20)], 10)).rejects.toThrow('fixture_http_size_limit');
  await expect(boundedJson([Buffer.from('invalid')])).rejects.toThrow();
});

test('session requires successful login and both cookies', () => {
  expect(() => fixtureSession({ status: 403 })).toThrow('fixture_login_failed');
  expect(() => fixtureSession({ status: 200, cookies: ['access_token=x'] })).toThrow('fixture_session_missing');
  expect(fixtureSession({ status: 200, cookies: ['access_token=x; HttpOnly', 'classifarr_csrf_token=y; Path=/'] }))
    .toEqual({ cookie: 'access_token=x; classifarr_csrf_token=y', 'x-csrf-token': 'y' });
});

test('existing provider/user state refuses writes', async () => {
  const query = jest.fn(async () => ({ rows: [{ users: 1, radarr: 0, sonarr: 0, tmdb: 0 }] }));
  await expect(seedHttpRouting({ query })).rejects.toThrow('routing_fixture_requires_empty_providers');
  expect(query).toHaveBeenCalledTimes(1);
});

test('receipt verifies persisted routing with no writes', async () => {
  const query = jest.fn(async () => ({ rows: rows() }));
  expect(await readHttpRouting({ query })).toEqual(rows());
  expect(query.mock.calls[0][0]).toMatch(/^SELECT/);
});

test.each(['duplicate', 'method', 'status', 'destination', 'identity', 'id'])('rejects wrong %s', async kind => {
  const data = rows();
  if (kind === 'duplicate') data.push(data[0]);
  if (kind === 'method') data[0].method = 'fallback';
  if (kind === 'status') data[0].status = 'completed';
  if (kind === 'destination') data[0].external_id = 'other';
  if (kind === 'identity') data[0].tmdb_id = 1;
  if (kind === 'id') data[0].id = '0';
  await expect(readHttpRouting({ query: async () => ({ rows: data }) })).rejects.toThrow();
});

test('partial history cannot announce fixture completion', async () => {
  const pending = rows(); pending[0].verified = null;
  await expect(readHttpRouting({ query: async () => ({ rows: pending }) })).resolves.toBeNull();
  const wait = jest.fn(async () => {});
  const query = jest.fn().mockResolvedValueOnce({ rows: pending }).mockResolvedValue({ rows: rows() });
  expect(await waitForHttpRouting({ query }, { wait })).toEqual(rows());
  expect(wait).toHaveBeenCalledTimes(1);
  let time = 0;
  await expect(waitForHttpRouting({ query: async () => ({ rows: [] }) }, { wait, now: () => time++, timeout: 2 }))
    .rejects.toThrow('routing_fixture_timeout');
});

test('real loopback fixture counts attempted duplicate adds and rejects unexpected operations', async () => {
  const provider = await startRoutingProvider();
  const request = (path, body, method = body ? 'POST' : 'GET') => fetch(`http://127.0.0.1:21401${path}`, {
    method, headers: { 'x-api-key': 'synthetic-routing', 'content-type': 'application/json', connection: 'close' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(2000),
  });
  try {
    const path = '/radarr/api/v3/movie';
    expect(await (await request(`${path}?tmdbId=910001`)).json()).toEqual([]);
    const body = { tmdbId: 910001, qualityProfileId: 1, rootFolderPath: '/movies', addOptions: { searchForMovie: false } };
    expect((await request(path, body)).status).toBe(201);
    expect((await request(path, body)).status).toBe(400);
    expect((await request('/unexpected')).status).toBe(400);
    expect((await request(path, undefined, 'DELETE')).status).toBe(400);
    expect(await (await request(`${path}?tmdbId=910001`)).json()).toEqual([{ id: 7, tmdbId: 910001, path: '/movies/Synthetic' }]);
    expect(provider.counts).toMatchObject({ movieReads: 2, movieAdds: 2, unexpected: 3 });
  } finally { await provider.close(); }
});

// Keep fixed-port HTTP cases in this suite so Jest workers cannot bind it concurrently.
test('held HTTP add stores provider effect but never acknowledges it', async () => {
  let accepted;
  const arrived = new Promise(resolve => { accepted = resolve; });
  const provider = await startRoutingProvider({ holdAfterAdd: accepted });
  const controller = new AbortController();
  const pending = fetch('http://127.0.0.1:21401/radarr/api/v3/movie', {
    method: 'POST', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(2000)]),
    headers: { 'x-api-key': 'synthetic-routing', 'content-type': 'application/json', connection: 'close' },
    body: JSON.stringify({ tmdbId: 910001, qualityProfileId: 1, rootFolderPath: '/movies', addOptions: { searchForMovie: false } }),
  }).then(() => 'acknowledged', () => 'interrupted');
  try {
    expect(await Promise.race([arrived, pending.then(() => { throw new Error('request_ended_before_acceptance'); })])).toBe('movie');
    const response = await fetch('http://127.0.0.1:21401/radarr/api/v3/movie?tmdbId=910001', {
      headers: { 'x-api-key': 'synthetic-routing', connection: 'close' }, signal: AbortSignal.timeout(2000),
    });
    expect(await response.json()).toEqual([{ id: 7, tmdbId: 910001, path: '/movies/Synthetic' }]);
    expect(provider.counts.movieAdds).toBe(1);
  } finally { controller.abort(); await provider.close(); }
  expect(await pending).toBe('interrupted');
});

test('startup health fixture allows only authenticated reads of three fixed endpoints', async () => {
  const provider = await startRoutingProvider({ healthChecks: true });
  const request = (path, method = 'GET') => fetch(`http://127.0.0.1:21401${path}`, {
    method, headers: { 'x-api-key': 'synthetic-routing', connection: 'close' }, signal: AbortSignal.timeout(2000),
  });
  try {
    for (const type of ['radarr', 'sonarr']) {
      for (const path of ['system/status', 'qualityprofile', 'rootfolder']) {
        expect((await request(`/${type}/api/v3/${path}`)).status).toBe(200);
      }
    }
    expect((await request('/radarr/api/v3/system/status', 'POST')).status).toBe(400);
    expect(provider.counts).toMatchObject({ healthReads: 6, movieAdds: 0, tvAdds: 0, unexpected: 1 });
  } finally { await provider.close(); }
});
