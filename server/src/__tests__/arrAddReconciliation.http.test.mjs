/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import { radarrService } from '../services/radarr.mjs';
import { sonarrService } from '../services/sonarr.mjs';
import { reconcileArrAdd } from '../services/arrAddReconciliation.mjs';

const providers = [
  ['radarr', radarrService, 'tmdbId', 'movie', 'getMovieByTmdbId', 'addMovie'],
  ['sonarr', sonarrService, 'tvdbId', 'series', 'getSeriesByTvdbId', 'addSeries'],
];
const scenarios = [
  ['fresh', true, 2, 1], ['lost-response', true, 2, 1], ['conflict-saved', true, 2, 1],
  ['duplicate-validation', true, 2, 1], ['conflict-absent', false, 2, 1], ['server-error-saved', true, 2, 1],
  ['server-error-absent', false, 2, 1], ['validation', false, 1, 1], ['unauthorized', false, 1, 1],
  ['already-there', true, 1, 0], ['other-root', false, 1, 0], ['post-other-root', false, 2, 1],
  ['malformed-read', false, 1, 0], ['missing-id', false, 1, 0], ['duplicate-read', false, 1, 0],
  ['unavailable-read', false, 1, 0], ['redirect-read', false, 1, 0], ['redirect-add', false, 2, 1],
  ['large-read', false, 1, 0], ['read-back-unavailable', false, 2, 1],
];

describe.each(providers)('%s reconciliation over real HTTP', (_provider, service, key, endpoint, lookup, add) => {
  test.each(scenarios)('%s: verifies state with bounded reads and one add at most', async (scenario, routed, reads, writes) => {
    let getCount = 0, postCount = 0, redirected = 0;
    const requests = [], identity = 42, root = '/media';
    const valid = { id: 1, [key]: identity, path: '/media/Title', rootFolderPath: root };
    let stored = scenario === 'already-there' ? valid : scenario === 'other-root' ? { ...valid, path: '/other/Title' } : null;
    const server = createServer(async (request, response) => {
      const url = new URL(request.url, 'http://fixture.invalid');
      requests.push({ method: request.method, path: url.pathname, query: url.searchParams.get(key), key: request.headers['x-api-key'] });
      response.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/redirect-target') { redirected++; response.end('{}'); return; }
      if (request.method === 'GET') {
        getCount++;
        if (scenario === 'redirect-read') { response.writeHead(302, { Location: '/redirect-target' }); response.end(); return; }
        if (scenario === 'large-read') {
          response.setHeader('Content-Encoding', 'gzip');
          response.end(gzipSync(JSON.stringify({ private: 'x'.repeat(2 * 1024 * 1024 + 1) }))); return;
        }
        if (scenario === 'unavailable-read' || (scenario === 'read-back-unavailable' && postCount)) {
          response.writeHead(503); response.end('{"error":"private"}'); return;
        }
        const body = scenario === 'malformed-read' ? {} : scenario === 'missing-id' ? [{ [key]: identity }]
          : scenario === 'duplicate-read' ? [valid, valid] : stored ? [stored] : [];
        response.end(JSON.stringify(body)); return;
      }
      postCount++;
      for await (const _chunk of request) { /* Drain the fixed synthetic request. */ }
      if (scenario === 'validation' || scenario === 'unauthorized') {
        response.writeHead(scenario === 'validation' ? 400 : 401); response.end('{"error":"private-key"}'); return;
      }
      if (scenario === 'redirect-add') { response.writeHead(307, { Location: '/redirect-target' }); response.end(); return; }
      if (!['conflict-absent', 'server-error-absent'].includes(scenario)) {
        stored = scenario === 'post-other-root' ? { ...valid, path: '/other/Title' } : valid;
      }
      if (scenario === 'lost-response') { response.destroy(); return; }
      if (scenario === 'duplicate-validation') {
        response.writeHead(400); response.end(JSON.stringify([{ errorCode: key === 'tmdbId' ? 'MovieExistsValidator' : 'SeriesExistsValidator' }])); return;
      }
      response.writeHead(scenario.startsWith('conflict') ? 409 : scenario.startsWith('server-error') ? 503 : 201);
      response.end(JSON.stringify(stored || { private: 'not proof' }));
    });
    try {
      server.listen(0, '127.0.0.1'); await once(server, 'listening');
      const origin = `http://127.0.0.1:${server.address().port}`;
      const result = await reconcileArrAdd({
        expected: { identityKey: key, identity, rootFolderPath: root },
        read: () => service[lookup](origin, 'fixture-only-key', identity),
        add: () => service[add](origin, 'fixture-only-key', { [key]: identity, rootFolderPath: root, title: 'Title' }),
      });
      expect(result.routed).toBe(routed);
      expect(getCount).toBe(reads); expect(postCount).toBe(writes); expect(redirected).toBe(0);
      expect(JSON.stringify(result)).not.toMatch(/private|fixture-only-key|127\.0\.0\.1/);
      expect(requests.every(r => r.path === `/api/v3/${endpoint}` && r.key === 'fixture-only-key')).toBe(true);
      expect(requests.filter(r => r.method === 'GET').every(r => r.query === '42')).toBe(true);
      if (routed) {
        expect(result.reason).toBe(scenario === 'fresh' ? 'routed' : 'already_in_arr');
        expect(stored).toEqual(valid);
      }
    } finally {
      server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); });
    }
  });
});
