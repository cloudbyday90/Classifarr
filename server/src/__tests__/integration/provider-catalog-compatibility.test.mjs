/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { legacyEmbyCatalog, jellyfinCatalog, embyQueryPages, expectedCatalog } from '../fixtures/libraryCatalogCompatibility.mjs';
import { embyService } from '../../services/mediaServers/emby.mjs';
import { jellyfinService } from '../../services/mediaServers/jellyfin.mjs';
import { reconcileMediaServerLibraries } from '../../services/mediaServerLibrarySync.mjs';
import { createLibraryArchiveService } from '../../services/libraryArchiveService.mjs';

const db = createIntegrationDatabaseModuleMock();
let server, baseUrl, respond, sourceId, libraryId;
let requests = [];
const resolveService = type => type === 'emby' ? embyService : jellyfinService;
const reconcile = () => reconcileMediaServerLibraries({ db, getMediaServerServiceByType: resolveService });
const send = (res, data, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
};
beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url, baseUrl);
    requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers });
    respond(req, res, url);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/emby`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
});
beforeEach(async () => {
  requests = [];
  respond = (_req, res) => send(res, { Items: [], TotalRecordCount: 0 });
  await db.query('UPDATE media_server SET is_active=false');
  sourceId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('emby',$1,$2,'synthetic-token') RETURNING id", [randomUUID(), baseUrl])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(media_server_id,external_id,name,media_type,is_active) VALUES ($1,'retained-old','Preserved','movie',false) RETURNING id", [sourceId])).rows[0].id;
  await db.query("INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type) VALUES ($1,$2,'item','Synthetic','movie')", [sourceId, libraryId]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await db.query('DELETE FROM libraries WHERE media_server_id=$1', [sourceId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [sourceId]);
});

test.each(['current Emby', 'legacy Emby', 'Jellyfin'])('%s actual HTTP adapter reconciles supported catalogs while preserving old inventory', async mode => {
  if (mode === 'Jellyfin') await db.query("UPDATE media_server SET type='jellyfin' WHERE id=$1", [sourceId]);
  respond = (_req, res, url) => {
    if (mode === 'Jellyfin') return send(res, jellyfinCatalog);
    if (mode === 'legacy Emby') return send(res, url.pathname.endsWith('/Query') ? {} : legacyEmbyCatalog, url.pathname.endsWith('/Query') ? 404 : 200);
    return send(res, embyQueryPages[url.searchParams.get('StartIndex') === '0' ? 0 : 1]);
  };
  const result = await reconcile();
  expect(result.libraries.map(({ external_id, name, media_type }) => ({ external_id, name, media_type }))).toEqual(expectedCatalog.slice(0, 2));
  expect(result.preservedLibraries).toEqual([{ id: libraryId, name: 'Preserved' }]);
  expect((await db.query('SELECT external_id FROM media_server_items WHERE library_id=$1', [libraryId])).rows).toEqual([{ external_id: 'item' }]);
  expect((await db.query('SELECT count(*)::int AS n FROM libraries WHERE media_server_id=$1', [sourceId])).rows[0].n).toBe(3);
  expect(requests).toHaveLength(mode === 'Jellyfin' ? 1 : 2);
  expect(requests.every(req => req.headers['x-emby-token'] === 'synthetic-token' && !JSON.stringify(req.query).includes('synthetic-token'))).toBe(true);
});

test.each(['changed total', 'repeated identity', 'empty page', 'later missing endpoint', 'truncated JSON', 'oversized response'])('%s prevents all reconciliation writes, including the valid first page', async failure => {
  respond = (_req, res, url) => {
    if (url.searchParams.get('StartIndex') === '0') return send(res, embyQueryPages[0]);
    if (failure === 'later missing endpoint') return send(res, { secret: 'synthetic-token' }, 404);
    if (failure === 'truncated JSON') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"Items":'); }
    if (failure === 'oversized response') return send(res, { payload: 'x'.repeat(4194305) });
    const data = failure === 'changed total' ? { ...embyQueryPages[1], TotalRecordCount: 4 }
      : failure === 'repeated identity' ? { ...embyQueryPages[1], Items: [...embyQueryPages[0].Items, legacyEmbyCatalog[2]] }
        : { TotalRecordCount: 3, Items: [] };
    send(res, data);
  };
  const transaction = jest.spyOn(db, 'withTransaction');
  await expect(reconcile()).rejects.toMatchObject({ status: 503 });
  expect(transaction).not.toHaveBeenCalled();
  expect(requests).toHaveLength(2);
  expect(requests.every(req => req.path.endsWith('/Query'))).toBe(true);
  expect((await db.query('SELECT id,name,is_active FROM libraries WHERE media_server_id=$1', [sourceId])).rows)
    .toEqual([{ id: libraryId, name: 'Preserved', is_active: false }]);
  expect((await db.query('SELECT count(*)::int AS n FROM media_server_items WHERE library_id=$1', [libraryId])).rows[0].n).toBe(1);
  expect((await db.query('SELECT last_sync FROM media_server WHERE id=$1', [sourceId])).rows[0].last_sync).toBeNull();
});

test('archive cannot use an incomplete current catalog as evidence of absence', async () => {
  const actorId = (await db.query("INSERT INTO users(username,password_hash,role,is_active) VALUES ($1,'synthetic','admin',true) RETURNING id", [randomUUID()])).rows[0].id;
  respond = (_req, res, url) => send(res, url.searchParams.get('StartIndex') === '0' ? embyQueryPages[0] : { Items: [], TotalRecordCount: 3 });
  try {
    const archive = createLibraryArchiveService(db, resolveService);
    await expect(archive.preview(actorId, libraryId)).rejects.toMatchObject({ code: 'library_catalog_invalid' });
    expect((await db.query('SELECT archived_at FROM libraries WHERE id=$1', [libraryId])).rows[0].archived_at).toBeNull();
  } finally { await db.query('DELETE FROM users WHERE id=$1', [actorId]); }
});

test('empty current catalog preserves the existing library without trying legacy discovery', async () => {
  expect(await reconcile()).toEqual({ libraries: [], preservedLibraries: [{ id: libraryId, name: 'Preserved' }] });
  expect(requests).toHaveLength(1);
});

test('caller cancellation interrupts a waiting actual HTTP request without legacy fallback', async () => {
  const entered = Promise.withResolvers();
  respond = () => entered.resolve();
  const controller = new AbortController();
  const result = embyService.getLibraryCatalog(baseUrl, 'synthetic-token', { signal: controller.signal }).catch(error => error);
  await entered.promise; controller.abort(new Error('synthetic-token'));
  const error = await result;
  expect(error).toMatchObject({ code: 'library_catalog_unavailable' });
  expect(JSON.stringify(error)).not.toContain('synthetic-token');
  expect(requests).toHaveLength(1);
  server.closeAllConnections();
});
