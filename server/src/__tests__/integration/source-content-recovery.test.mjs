/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { resourceAdmissionFixture } from '../helpers/resourceAdmissionFixture.mjs';
import { getMediaServerService } from '../../services/mediaServers/index.mjs';
import { createMediaSyncOwnership } from '../../services/mediaSyncOwnership.mjs';
import { mediaSyncDatabase } from '../../services/mediaSyncDatabaseScope.mjs';
import { createSourceContentAdmission, SOURCE_CONTENT_PROBE_LOCK } from '../../services/sourceContentAdmission.mjs';
import { createSourceContentCircuitRepository } from '../../services/sourceContentCircuitRepository.mjs';
import { LIBRARY_INGESTION_STATUS_SQL, LIBRARY_INGESTION_WATCHDOG_SQL } from '../../services/libraryIngestionStatus.mjs';
import { readInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
jest.unstable_mockModule('../../services/contentTypeAnalyzer.mjs', () => ({ contentTypeAnalyzer: { analyze: async () => ({ analyzed: false }) } }));
const { MediaSyncService } = await import('../../services/mediaSync.mjs');
const db = createIntegrationDatabaseModuleMock();
let server, url, sourceId, libraries, provider, respond, calls;
const send = (res, payload, code = 200, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(payload)); };
function healthy(req, res) {
  const parsed = new URL(req.url, url), query = parsed.searchParams;
  const collections = parsed.pathname.endsWith('/collections') || query.get('IncludeItemTypes') === 'BoxSet';
  const key = provider === 'plex' ? parsed.pathname.split('/')[3] : query.get('ParentId');
  const tv = key === 'shows', offset = Number(query.get('StartIndex') ?? query.get('X-Plex-Container-Start') ?? 0);
  const limit = Number(query.get('Limit') ?? query.get('X-Plex-Container-Size') ?? 100);
  const items = collections ? [] : Array.from({ length: 5 }, (_, i) => provider === 'plex'
    ? { ratingKey: String(i + 1), title: `Synthetic ${i}`, type: tv ? 'show' : 'movie', Guid: [{ id: `tmdb://${i + 1}` }] }
    : { Id: String(i + 1), Name: `Synthetic ${i}`, Type: tv ? 'Series' : 'Movie', ProviderIds: { Tmdb: String(i + 1) } });
  const page = items.slice(offset, offset + limit);
  send(res, provider === 'plex' ? { MediaContainer: { Metadata: page, size: page.length, totalSize: items.length, offset } }
    : { Items: page, TotalRecordCount: items.length, StartIndex: offset });
}
const circuit = async () => (await db.query('SELECT * FROM media_source_content_circuits WHERE media_server_id=$1', [sourceId])).rows[0];
const due = async () => {
  await db.query("UPDATE media_source_content_circuits SET next_attempt_at=clock_timestamp()-INTERVAL '1 second' WHERE media_server_id=$1 AND next_attempt_at IS NOT NULL", [sourceId]);
  await db.query("UPDATE library_ingestion_state SET retry_after=clock_timestamp()-INTERVAL '1 second' WHERE library_id=ANY($1)", [libraries]);
};
const sync = () => new MediaSyncService({ resourceAdmission: resourceAdmissionFixture(), skipReporter: { report: async () => {} } });
const source = async (id = libraries[0]) => (await db.query(`SELECT l.*,ms.type,ms.url,ms.api_key,ms.catalog_revision
  FROM libraries l JOIN media_server ms ON ms.id=l.media_server_id WHERE l.id=$1`, [id])).rows[0];
beforeAll(async () => {
  server = createServer((req, res) => { calls++; respond(req, res); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); url = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); });
beforeEach(async () => {
  provider = 'jellyfin'; calls = 0; respond = (_req, res) => send(res, {}, 503);
  await db.query('UPDATE media_server SET is_active=false');
  sourceId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('jellyfin',$1,$2,'synthetic') RETURNING id", [randomUUID(), url])).rows[0].id;
  libraries = [];
  for (const [key, type] of [['films', 'movie'], ['shows', 'tv']]) libraries.push((await db.query(
    'INSERT INTO libraries(media_server_id,external_id,name,media_type) VALUES ($1,$2,$3,$4) RETURNING id',
    [sourceId, key, randomUUID(), type])).rows[0].id);
});
afterEach(async () => {
  server.closeAllConnections();
  await db.query('DELETE FROM media_server_sync_status WHERE media_server_id=$1', [sourceId]);
  await db.query('DELETE FROM libraries WHERE media_server_id=$1', [sourceId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [sourceId]);
});

test.each(['plex', 'emby', 'jellyfin'])('%s recovers movie and TV content without admitting learning early', async type => {
  provider = type; await db.query('UPDATE media_server SET type=$2 WHERE id=$1', [sourceId, type]);
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  expect(await sync().syncLibrary(libraries[0])).toMatchObject({ deferred: true, reason: 'source_content_cooldown' });
  expect(await sync().syncLibrary(libraries[1])).toMatchObject({ reason: 'source_content_cooldown' }); expect(calls).toBe(1);
  expect((await db.query(LIBRARY_INGESTION_WATCHDOG_SQL)).rows.map(row => row.id)).not.toContain(libraries[1]);
  const status = (await db.query(`SELECT ${LIBRARY_INGESTION_STATUS_SQL} AS status FROM libraries l WHERE id=$1`, [libraries[1]])).rows[0].status;
  expect(status).toMatchObject({ state: 'awaiting_import', sourceRecovery: { state: 'open', attempts: 1, reason: 'provider_unavailable' } });
  expect(await readInventoryBackgroundReadiness(db)).not.toBe('ready');
  await due(); respond = healthy;
  expect(await sync().syncLibrary(libraries[0])).toMatchObject({ success: true, totalItems: 5 });
  expect(await circuit()).toMatchObject({ state: 'closed', attempts: 0, next_attempt_at: null });
  expect(await readInventoryBackgroundReadiness(db)).not.toBe('ready');
  expect(await sync().syncLibrary(libraries[1])).toMatchObject({ success: true, totalItems: 5 });
  expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
});

test('100 libraries share one outage request; waiting libraries do not charge ingestion attempts', async () => {
  for (let i = 2; i < 100; i++) libraries.push((await db.query(
    "INSERT INTO libraries(media_server_id,external_id,name,media_type) VALUES ($1,$2,$3,'movie') RETURNING id", [sourceId, `film-${i}`, randomUUID()])).rows[0].id);
  for (const id of libraries) expect(await sync().syncLibrary(id)).toMatchObject({ reason: 'source_content_cooldown' });
  expect(calls).toBe(1);
  expect((await db.query('SELECT * FROM library_ingestion_state WHERE library_id=ANY($1)', [libraries])).rows).toHaveLength(1);
  expect(await circuit()).toMatchObject({ state: 'open', attempts: 1 });
});

test('healthy imports remain concurrent, while a due probe stays exclusive even when its timestamp is forced past', async () => {
  let arrivals = 0, notify;
  const entered = new Promise(resolve => { notify = resolve; }); const held = [];
  respond = (req, res) => { held.push(() => healthy(req, res)); if (++arrivals === 2) notify(); };
  const imports = libraries.map(id => sync().syncLibrary(id)); await entered;
  respond = healthy; held.forEach(finish => finish());
  expect((await Promise.all(imports)).every(result => result.success)).toBe(true);
  respond = (_req, res) => send(res, {}, 503); await sync().syncLibrary(libraries[0]); await due();
  let finish, started; const probing = new Promise(resolve => { started = resolve; });
  respond = (req, res) => { finish = () => healthy(req, res); started(); };
  const running = sync().syncLibrary(libraries[0]); await probing;
  try {
    const before = calls; await due();
    expect(await sync().syncLibrary(libraries[1])).toMatchObject({ reason: 'source_content_probe_busy' });
    expect(calls).toBe(before);
  } finally { respond = healthy; finish(); await running; }
});

test('media success cannot clear a collection outage; five attempts lead to sparse probes across restart', async () => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await due();
    respond = (req, res) => new URL(req.url, url).searchParams.get('IncludeItemTypes') === 'BoxSet' ? send(res, {}, 503) : healthy(req, res);
    expect(await sync().syncLibrary(libraries[0])).toMatchObject({ reason: 'source_content_cooldown' });
    expect(await circuit()).toMatchObject({ state: 'open', attempts: attempt });
  }
  const row = await circuit(); expect(row.next_attempt_at - row.updated_at).toBeGreaterThanOrEqual(21599000);
  const before = calls; await sync().syncLibrary(libraries[1]); expect(calls).toBe(before);
  await due(); respond = healthy; expect((await sync().syncLibrary(libraries[1])).success).toBe(true);
});

test.each([401, 403, 404, 500, 'malformed'])('%s remains library-local and does not block another library', async failure => {
  respond = (req, res) => new URL(req.url, url).searchParams.get('ParentId') === 'films'
    ? send(res, {}, failure === 'malformed' ? 200 : failure) : healthy(req, res);
  expect(await sync().syncLibrary(libraries[0])).toMatchObject({ reason: 'source_preflight_unavailable' });
  expect(await circuit()).toMatchObject({ state: 'closed' });
  expect((await sync().syncLibrary(libraries[1])).success).toBe(true);
});

test.each(['86400', '999999999999999999999'])('Retry-After %s is preserved, and only a changed source revision bypasses its wait', async delay => {
  respond = (_req, res) => send(res, { token: 'synthetic-secret' }, 429, { 'Retry-After': delay });
  await sync().syncLibrary(libraries[0]); const row = await circuit();
  if (delay === '86400') expect(row.next_attempt_at - row.updated_at).toBeGreaterThanOrEqual(86399000);
  else expect(row).toMatchObject({ state: 'review', next_attempt_at: null });
  await sync().syncLibrary(libraries[1]); expect(calls).toBe(1);
  expect(JSON.stringify(row)).not.toContain('synthetic-secret');
  await db.query("UPDATE media_server SET api_key='rotated' WHERE id=$1", [sourceId]); respond = healthy;
  expect((await sync().syncLibrary(libraries[1])).success).toBe(true);
});

test('late normal-page failures retain classification and cannot prune old inventory', async () => {
  await db.query("INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type) VALUES ($1,$2,'old','Synthetic','movie')", [sourceId, libraries[0]]);
  respond = (req, res) => Number(new URL(req.url, url).searchParams.get('StartIndex')) >= 4 ? send(res, {}, 503) : healthy(req, res);
  expect(await sync().syncLibrary(libraries[0], { batchSize: 2 })).toMatchObject({ reason: 'source_content_cooldown' });
  expect((await db.query("SELECT external_id FROM media_server_items WHERE library_id=$1 AND external_id='old'", [libraries[0]])).rows).toHaveLength(1);
  expect(await circuit()).toMatchObject({ state: 'open', reason: 'provider_unavailable' });
});

test('recovery canary permissions preserve the collection cause through the outer media preflight', async () => {
  await sync().syncLibrary(libraries[0]); await due();
  respond = (req, res) => new URL(req.url, url).searchParams.get('IncludeItemTypes') === 'BoxSet' ? send(res, {}, 403) : healthy(req, res);
  expect(await sync().syncLibrary(libraries[0])).toMatchObject({ reason: 'source_preflight_unavailable', phase: 'collections', detail: 'access_denied' });
  expect(await circuit()).toMatchObject({ state: 'open', reason: 'probe_inconclusive' });
  const { rows: [status] } = await db.query('SELECT error_message FROM media_server_sync_status WHERE library_id=$1', [libraries[0]]);
  expect(status.error_message).toContain('collections:access_denied');
  await due(); respond = healthy;
  expect((await sync().syncLibrary(libraries[1])).success).toBe(true);
});

test('newer failures fence probe success; late errors cannot shorten waits or unpause review', async () => {
  const saved = await source();
  await createMediaSyncOwnership(db)(libraries[0], async () => {
    const repo = createSourceContentCircuitRepository(mediaSyncDatabase, saved);
    const original = await repo.admit(async () => true);
    await repo.fail(original, { reason: 'unreachable' }); await due();
    const probe = await repo.admit(async () => true);
    await repo.fail(original, { reason: 'rate_limited', retryAfter: { delayMs: 86400000 } });
    await expect(repo.settleProbe(probe, true)).rejects.toMatchObject({ reason: 'source_content_cooldown' });
    expect((await circuit()).next_attempt_at - Date.now()).toBeGreaterThan(86390000);
    await repo.fail(original, { reason: 'rate_limited', retryAfter: { blocked: true } });
    await repo.fail(original, { reason: 'unreachable' });
    expect((await circuit()).state).toBe('review');
  });
});

test('lost database probe ownership aborts HTTP and retains the charged restart delay', async () => {
  await sync().syncLibrary(libraries[0]); await due();
  const saved = await source(); let notify; const entered = new Promise(resolve => { notify = resolve; });
  respond = () => { notify(); };
  const run = createMediaSyncOwnership(db)(libraries[0], async owner => {
    const pid = (await mediaSyncDatabase.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const gate = createSourceContentAdmission({ db: mediaSyncDatabase, source: saved, owner });
    const request = gate.page(await getMediaServerService(provider), 'getLibraryPage', url, 'synthetic', 'films', { offset: 0, limit: 2, signal: owner.signal });
    const rejected = expect(request).rejects.toBeInstanceOf(Error);
    await entered; await db.query('SELECT pg_terminate_backend($1)', [pid]); await rejected;
  });
  await run;
  expect(await circuit()).toMatchObject({ state: 'probing', attempts: 2, reason: 'probe_interrupted' });
  expect((await circuit()).next_attempt_at - Date.now()).toBeGreaterThan(21590000);
  await db.withTransaction(async tx => {
    expect((await tx.query('SELECT pg_try_advisory_xact_lock($1::integer,$2::integer) AS acquired', [SOURCE_CONTENT_PROBE_LOCK, sourceId])).rows[0].acquired).toBe(true);
  });
});

test('one unavailable source does not pause an independent configured source', async () => {
  await sync().syncLibrary(libraries[0]);
  const other = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('jellyfin',$1,$2,'other') RETURNING id", [randomUUID(), `${url}/independent`])).rows[0].id;
  let library;
  try {
    library = (await db.query("INSERT INTO libraries(media_server_id,external_id,name,media_type) VALUES ($1,'films',$2,'movie') RETURNING id", [other, randomUUID()])).rows[0].id;
    respond = healthy;
    expect((await sync().syncLibrary(library)).success).toBe(true);
    expect((await circuit()).state).toBe('open');
  } finally {
    await db.query('DELETE FROM media_server_sync_status WHERE media_server_id=$1', [other]);
    await db.query('DELETE FROM libraries WHERE media_server_id=$1', [other]);
    await db.query('DELETE FROM media_server WHERE id=$1', [other]);
  }
});
