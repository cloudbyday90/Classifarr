/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';

/** Loopback-only synthetic Jellyfin; production parsing, scheduler and workers stay intact. */
export async function createScheduledInstallationFixture() {
  assertUpgradeDrillEnvironment();
  let held = true, reached = false;
  const pending = new Set();
  const requests = { movie: 0, tv: 0, audio: 0 };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const key = url.searchParams.get('ParentId');
    const type = key === 'scheduler-movie' ? 'movie' : key === 'scheduler-tv' ? 'tv' : null;
    const offset = Number(url.searchParams.get('StartIndex') ?? 0);
    const limit = Number(url.searchParams.get('Limit') ?? 100);
    const send = (body, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body));
    };
    if (req.method !== 'GET' || url.pathname !== '/Items' || !type || !Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) { send({}, 400); return; }
    const deliver = () => {
      const collections = url.searchParams.get('IncludeItemTypes') === 'BoxSet';
      const items = collections ? [] : [0, 1].map(n => ({ Id: `${key}-${n}`, Name: `Synthetic ${type} ${n}`,
        Type: type === 'tv' ? 'Series' : 'Movie', ProductionYear: 2001, ProviderIds: { Tmdb: String(100 + n) } }));
      if (!collections) items.push({ Id: `${key}-audio`, Name: 'Ignored audio', Type: 'Audio' });
      const page = items.slice(offset, offset + limit);
      requests[type]++;
      requests.audio += page.filter(item => item.Type === 'Audio').length;
      send({ Items: page, TotalRecordCount: items.length, StartIndex: offset });
    };
    if (held) { reached = true; pending.add(deliver); res.on('close', () => pending.delete(deliver)); }
    else deliver();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return {
    origin: `http://127.0.0.1:${server.address().port}`, requests,
    get reached() { return reached; },
    release() { held = false; for (const deliver of pending) deliver(); pending.clear(); },
    async close() { pending.clear(); server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); },
  };
}

export async function seedScheduledInstallation(db, origin) {
  assertUpgradeDrillEnvironment();
  if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(origin)) throw new Error('scheduler_fixture_origin_invalid');
  return db.withTransaction(async client => {
    const { rows: [source] } = await client.query(`INSERT INTO media_server(type,name,url,api_key,is_active)
      VALUES ('jellyfin','Synthetic scheduler',$1,'synthetic-only',true) RETURNING id`, [origin]);
    const { rows } = await client.query(`INSERT INTO libraries(media_server_id,external_id,name,media_type,is_active)
      VALUES ($1,'scheduler-movie','Synthetic scheduled movie','movie',true),
             ($1,'scheduler-tv','Synthetic scheduled TV','tv',true) RETURNING id,media_type`, [source.id]);
    await client.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
    return rows;
  });
}
