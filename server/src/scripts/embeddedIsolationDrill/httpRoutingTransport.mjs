/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';

export async function boundedJson(stream, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    assert(size <= limit, 'fixture_http_size_limit');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function fixtureRequest(path, { session, body } = {}) {
  assert(/^\/api\/[a-z/-]+$/.test(path)
    || /^\/api\/queue\/(tasks\/[1-9]\d*\/classify|manual-routing\/[1-9]\d*\/(check|background))$/.test(path), 'fixture_http_path');
  const response = await fetch(`http://127.0.0.1:21324${path}`, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { 'content-type': 'application/json', ...session },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await boundedJson(response.body), cookies: response.headers.getSetCookie() };
}

export function fixtureSession(response) {
  assert.equal(response.status, 200, 'fixture_login_failed');
  const cookies = response.cookies.map(value => value.split(';')[0]);
  const csrf = cookies.find(value => value.startsWith('classifarr_csrf_token='))?.split('=')[1];
  assert(csrf && cookies.some(value => value.startsWith('access_token=')), 'fixture_session_missing');
  return { cookie: cookies.join('; '), 'x-csrf-token': csrf };
}

export async function startRoutingProvider({ holdAfterAdd, healthChecks = false, hideAccepted = false } = {}) {
  const counts = { tmdb: 0, movieReads: 0, tvReads: 0, movieAdds: 0, tvAdds: 0, unexpected: 0 };
  if (healthChecks) counts.healthReads = 0;
  const stored = new Map();
  const server = createServer({ requestTimeout: 5000, headersTimeout: 5000 }, (req, res) => {
    const respond = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    void (async () => {
      const url = new URL(req.url, 'http://127.0.0.1:21401');
      if (req.method === 'GET' && url.pathname.startsWith('/tmdb/')) {
        assert.equal(url.searchParams.get('api_key'), 'synthetic-routing');
        counts.tmdb++;
        if (url.pathname === '/tmdb/movie/910001/releases') return respond(200, { countries: [] });
        if (url.pathname === '/tmdb/tv/910002/content_ratings') return respond(200, { results: [] });
        if (url.pathname === '/tmdb/tv/910002/external_ids') return respond(200, { tvdb_id: 920002 });
        assert(['/tmdb/movie/910001', '/tmdb/tv/910002'].includes(url.pathname));
        const title = url.pathname.includes('/movie/') ? 'Isolated HTTP movie' : 'Isolated HTTP series';
        return respond(200, { title, name: title, release_date: '2026-01-01', first_air_date: '2026-01-01',
          overview: 'Synthetic deterministic policy fixture.', genres: [{ name: 'Action' }],
          keywords: { keywords: [{ name: 'chase' }], results: [{ name: 'chase' }] } });
      }
      assert.equal(req.headers['x-api-key'], 'synthetic-routing');
      if (healthChecks && req.method === 'GET'
        && /^\/(radarr|sonarr)\/api\/v3\/(system\/status|qualityprofile|rootfolder)$/.test(url.pathname)) {
        assert.equal(url.search, '');
        counts.healthReads++;
        if (url.pathname.endsWith('/system/status')) return respond(200, { version: 'fixture' });
        if (url.pathname.endsWith('/qualityprofile')) return respond(200, [{ id: 1, name: 'Fixture' }]);
        return respond(200, [{ id: 1, path: url.pathname.startsWith('/radarr/') ? '/movies' : '/tv' }]);
      }
      if (req.method === 'GET' && url.pathname === '/sonarr/api/v3/series/lookup') {
        assert.equal(url.searchParams.get('term'), 'tvdb:920002');
        return respond(200, [{ title: 'Isolated HTTP series', tvdbId: 920002, seasons: [] }]);
      }
      const movie = url.pathname === '/radarr/api/v3/movie';
      assert(movie || url.pathname === '/sonarr/api/v3/series');
      const kind = movie ? 'movie' : 'tv', key = movie ? 'tmdbId' : 'tvdbId', id = movie ? 910001 : 920002;
      if (req.method === 'GET') {
        assert.equal(url.searchParams.get(key), String(id));
        counts[`${kind}Reads`]++;
        return respond(200, !hideAccepted && stored.has(kind) ? [stored.get(kind)] : []);
      }
      // Count every attempted add, including invalid or duplicate requests.
      if (req.method === 'POST') counts[`${kind}Adds`]++;
      assert.equal(req.method, 'POST');
      assert(!stored.has(kind), 'duplicate_add');
      const body = await boundedJson(req, 16 * 1024);
      assert.equal(body[key], id);
      assert.equal(body.rootFolderPath, movie ? '/movies' : '/tv');
      assert.equal(body.qualityProfileId, 1);
      assert.equal(body.addOptions[movie ? 'searchForMovie' : 'searchForMissingEpisodes'], false);
      const item = { id: movie ? 7 : 8, [key]: id, path: `${body.rootFolderPath}/Synthetic` };
      stored.set(kind, item);
      // The supervising fixture survives the application crash. Never acknowledge
      // this add when testing the remote-success/local-unknown boundary.
      if (holdAfterAdd) { holdAfterAdd(kind); return; }
      respond(201, item);
    })().catch(() => { counts.unexpected++; if (!res.headersSent) respond(400, {}); else res.destroy(); });
  });
  server.maxConnections = 8;
  server.setTimeout(5000, socket => socket.destroy());
  server.listen(21401, '127.0.0.1');
  await once(server, 'listening');
  return { counts, close: async () => {
    const closed = new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
    server.closeAllConnections();
    await closed;
  } };
}
