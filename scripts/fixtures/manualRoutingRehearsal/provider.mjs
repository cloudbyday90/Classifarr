/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { assertFixtureEnvironment, readFixtureFile, writeFixtureFile } from './support.mjs';

export function providerHandler({ read = readFixtureFile, write = writeFixtureFile, now = Date.now } = {}) {
  return (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:21400');
    const movie = url.pathname === '/radarr/api/v3/movie';
    const tv = url.pathname === '/sonarr/api/v3/series';
    const counts = read('requests');
    if (req.method !== 'GET') counts.writes++;
    const kind = movie ? 'movie' : tv ? 'tv' : null;
    if (!kind || req.method !== 'GET') {
      counts.unexpected++; write('requests', counts); res.writeHead(405); res.end('{}'); return;
    }
    counts[kind]++;
    const mode = read('control')[kind];
    if (mode === 'hold') counts.heldAt = now();
    write('requests', counts); // Persist arrival before allowing the runner to kill the container.
    if (mode === 'hold') return;
    if (mode === 'unauthorized' || (mode === 'present' && req.headers['x-api-key'] !== 'rotated-synthetic')) {
      res.writeHead(401, { 'content-type': 'application/json' }); res.end('{}'); return;
    }
    const identityKey = movie ? 'tmdbId' : 'tvdbId';
    const body = mode === 'present' ? [{ id: 7, [identityKey]: Number(url.searchParams.get(identityKey)),
      path: `${movie ? '/movies' : '/tv'}/Synthetic` }] : [];
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body));
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertFixtureEnvironment();
  const server = createServer(providerHandler());
  server.requestTimeout = 20_000; server.maxConnections = 8;
  server.listen(21400, '127.0.0.1');
}
