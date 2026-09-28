/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { once } from 'node:events';

/** Synthetic wire responses; production Jellyfin parsing is not replaced. */
export async function createJellyfinRecoveryFixture() {
  const libraries = new Map(), requests = [];
  let unavailable = true, barrier = null;
  const send = (res, body, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body));
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/Items') { send(res, {}, 404); return; }
    const key = url.searchParams.get('ParentId');
    const offset = Number(url.searchParams.get('StartIndex'));
    const limit = Number(url.searchParams.get('Limit'));
    const collections = url.searchParams.get('IncludeItemTypes') === 'BoxSet';
    requests.push({ key, offset, limit, collections });
    if (unavailable) { send(res, {}, 503); return; }
    const type = libraries.get(key);
    if (!type || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 2) {
      send(res, {}, 400); return;
    }
    if (barrier?.key === key && barrier.collections === collections && barrier.offset === offset && limit === 1) {
      barrier.reached = true; return; // Remains blocked until the owning worker is killed.
    }
    const items = collections
      ? Array.from({ length: 3 }, (_, i) => ({ Id: `${key}-collection-${i}`, Name: `Synthetic set ${i}`, Type: 'BoxSet', ChildCount: 1 }))
      : [...Array.from({ length: 4 }, (_, i) => ({ Id: `${key}-${i}`, Name: `Synthetic item ${i}`, Type: type === 'tv' ? 'Series' : 'Movie',
        ProductionYear: 2001, ProviderIds: { Tmdb: String(i + 1) } })), { Id: `${key}-audio`, Name: 'Ignored audio', Type: 'Audio' }];
    send(res, { Items: items.slice(offset, offset + limit), TotalRecordCount: items.length, StartIndex: offset });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return {
    origin: `http://127.0.0.1:${server.address().port}`, requests, libraries,
    recover() { unavailable = false; },
    block(key, collections = false) { barrier = { key, collections, offset: 2, reached: false }; },
    get blocked() { return barrier?.reached === true; },
    unblock() { barrier = null; server.closeAllConnections(); },
    async close() { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); },
  };
}
