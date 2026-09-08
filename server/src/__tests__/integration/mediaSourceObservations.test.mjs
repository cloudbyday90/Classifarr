/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { MediaSourceObservationStore } from '../../services/mediaSourceObservationStore.mjs';
import { readSourceObservationSummary } from '../../services/mediaSourceObservationSummary.mjs';
import { SOURCE_OBSERVATION_LIMITS } from '../../services/mediaSourceObservationContract.mjs';
import { MediaSyncLibraryStateService } from '../../services/mediaSyncLibraryStateService.mjs';
import { prepareQueueEnrichmentPayload } from '../../services/queueEnrichmentPayload.mjs';
import { persistResolvedIdentity } from '../../services/mediaResolvedIdentityPersistence.mjs';

let client, store, serverId, libraryId;
const conflict = (external_id = 'fixture', patch = {}) => ({ external_id, title: 'Fixture title', year: 2020,
  media_type: 'movie', provider_identity_invalid: true, provider_identity_issue: 'conflicting_provider_ids',
  provider_identity_field: 'tmdb_id', ...patch });
beforeEach(async () => {
  client = await getPool().connect(); await client.query('BEGIN');
  store = new MediaSourceObservationStore({ withTransaction: async fn => {
    await client.query('SAVEPOINT capture');
    try { const result = await fn(client); await client.query('RELEASE SAVEPOINT capture'); return result; }
    catch (error) { await client.query('ROLLBACK TO SAVEPOINT capture'); throw error; }
  } });
  serverId = (await client.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://fixture.invalid','fixture') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = await addLibrary();
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
async function addLibrary() {
  return (await client.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,$2,'movie',$3,true) RETURNING id",
    [randomUUID(), randomUUID(), serverId])).rows[0].id;
}
const start = options => store.start(serverId, libraryId, options);
const rows = async () => (await client.query('SELECT * FROM media_source_observations WHERE library_id=$1 ORDER BY external_id', [libraryId])).rows;
const summary = async () => (await readSourceObservationSummary(client)).libraries.find(l => l.id === libraryId);

test('captures repeated source membership without writing trusted inventory or exposing source keys', async () => {
  const before = (await client.query('SELECT COUNT(*) FROM media_server_items')).rows[0].count;
  let context = await start(); await store.capture(context, [conflict()]); await store.finish(context);
  const first = (await rows())[0];
  context = await start(); await store.capture(context, [conflict('fixture', { title: 'Updated' })]); await store.finish(context);
  expect(await rows()).toHaveLength(1);
  expect((await rows())[0]).toMatchObject({ title: 'Updated', first_seen_at: first.first_seen_at });
  expect((await client.query('SELECT COUNT(*) FROM media_server_items')).rows[0].count).toBe(before);
  const report = await summary();
  expect(report).toMatchObject({ status: 'complete', retainedCount: 1, examples: [{ title: 'Updated', identityIssue: 'conflicting_provider_ids' }] });
  expect(report.examples[0].sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(report.examples[0].external_id).toBeUndefined();
  expect(report.examples[0].tmdb_id).toBeUndefined();
});

test('valid identity removes its unresolved record without transferring data into inventory', async () => {
  let context = await start(); await store.capture(context, [conflict()]); await store.finish(context);
  context = await start(); await store.capture(context, [{ external_id: 'fixture', media_type: 'movie', tmdb_id: 42 }]); await store.finish(context);
  expect(await rows()).toEqual([]);
});

test('a fresh conflict blocks automatic authority until a valid source capture clears it', async () => {
  const itemId = (await client.query(`INSERT INTO media_server_items
    (media_server_id, library_id, external_id, title, year, media_type, tmdb_id)
    VALUES ($1, $2, 'fixture', 'Fixture title', 2020, 'movie', 42) RETURNING id`,
  [serverId, libraryId])).rows[0].id;
  const authority = new MediaSyncLibraryStateService({ db: client, logger: {
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
  } });
  const conflictCapture = await start();
  await store.capture(conflictCapture, [conflict()]);
  await store.finish(conflictCapture);
  await client.query(`INSERT INTO classification_history
    (tmdb_id, media_type, title, library_id, library_name, status)
    VALUES (42, 'movie', 'Fixture title', $1, 'Fixture', 'awaiting_decision')`, [libraryId]);

  await expect(authority.findExistingMedia(42, 'movie')).resolves.toBeNull();
  await expect(authority.reconcileAwaitingDecisions(libraryId)).resolves.toBe(0);
  const prepared = await prepareQueueEnrichmentPayload({ itemId, media_type: 'movie' }, client.query.bind(client));
  expect(prepared).toMatchObject({ source_conflict_blocks_authority: true });
  await client.query('UPDATE media_server_items SET tmdb_id=NULL WHERE id=$1', [itemId]);
  await expect(persistResolvedIdentity(client.query.bind(client), itemId, 42, 'movie', prepared.source_identity_snapshot))
    .resolves.toMatchObject({ rowCount: 0 });
  await expect(client.query('SELECT tmdb_id FROM media_server_items WHERE id=$1', [itemId]))
    .resolves.toMatchObject({ rows: [{ tmdb_id: null }] });

  await client.query('UPDATE media_server_items SET tmdb_id=42 WHERE id=$1', [itemId]);
  const validCapture = await start();
  await store.capture(validCapture, [{ external_id: 'fixture', media_type: 'movie', tmdb_id: 42 }]);
  await store.finish(validCapture);
  await expect(authority.findExistingMedia(42, 'movie')).resolves.toMatchObject({ id: itemId });
  await expect(authority.reconcileAwaitingDecisions(libraryId)).resolves.toBe(1);
  await expect(client.query(`SELECT status FROM classification_history
    WHERE library_id=$1 AND title='Fixture title'`, [libraryId]))
    .resolves.toMatchObject({ rows: [{ status: 'completed' }] });
});

test('failed and incremental scans preserve unseen observations; a full scan removes them', async () => {
  let context = await start(); await store.capture(context, [conflict()]); await store.finish(context);
  context = await start(); await store.finish(context, { failed: true });
  expect((await summary()).status).toBe('failed'); expect(await rows()).toHaveLength(1);
  context = await start({ incremental: true }); await store.finish(context);
  expect((await summary()).status).toBe('partial'); expect(await rows()).toHaveLength(1);
  context = await start(); await store.finish(context); expect(await rows()).toHaveLength(0);
});

test('valid duplicates cannot erase a rejection in the same capture, across or within pages', async () => {
  const valid = { external_id: 'fixture', media_type: 'movie', tmdb_id: 42 };
  for (const page of [[conflict(), valid], [valid, conflict()]]) {
    const context = await start();
    await store.capture(context, page);
    await store.capture(context, [valid]);
    await store.finish(context);
    expect(await rows()).toHaveLength(1);
  }
  const later = await start();
  await store.capture(later, [valid]); await store.finish(later);
  expect(await rows()).toHaveLength(0);
});

test('unusable source keys withhold absence cleanup', async () => {
  let context = await start(); await store.capture(context, [conflict()]); await store.finish(context);
  context = await start(); await store.capture(context, [conflict('')]); await store.finish(context);
  expect(await rows()).toHaveLength(1);
  expect(await summary()).toMatchObject({ status: 'partial', capture: { uncapturableCount: 1 } });
});

test('superseded pages and completion cannot overwrite or erase newer evidence', async () => {
  const older = await start(), newer = await start();
  await store.capture(newer, [conflict('new')]);
  expect(await store.capture(older, [conflict('old')])).toBe(false);
  expect(await store.finish(older)).toBe(false);
  await store.finish(newer);
  expect((await rows()).map(r => r.external_id)).toEqual(['new']);
  expect(await store.capture(newer, [conflict('late')])).toBe(false);
});

test('tracks multiple library memberships independently and cleans up movement and deletion', async () => {
  const other = await addLibrary();
  const left = await start(), right = await store.start(serverId, other);
  await store.capture(left, [conflict()]); await store.capture(right, [conflict()]);
  await store.finish(left); await store.finish(right);
  const moved = await start(); await store.finish(moved);
  expect(await rows()).toEqual([]);
  expect((await client.query('SELECT COUNT(*)::int AS count FROM media_source_observations WHERE library_id=$1', [other])).rows[0].count).toBe(1);
  await client.query('DELETE FROM libraries WHERE id=$1', [other]);
  expect((await client.query('SELECT COUNT(*)::int AS count FROM media_source_observations WHERE library_id=$1', [other])).rows[0].count).toBe(0);
});

test('reports unknown before capture and excludes/purges expired observations', async () => {
  expect((await summary()).status).toBe('not_captured');
  const context = await start(); await store.capture(context, [conflict()]); await store.finish(context);
  await client.query("UPDATE media_source_observations SET last_seen_at=NOW()-INTERVAL '31 days' WHERE library_id=$1", [libraryId]);
  await client.query("UPDATE media_source_capture_state SET started_at=NOW()-INTERVAL '31 days' WHERE library_id=$1", [libraryId]);
  expect(await summary()).toMatchObject({ status: 'expired', retainedCount: 0, examples: [] });
  await start(); expect(await rows()).toHaveLength(0);
});

test('bounds retention and previews, records omissions and still refreshes retained rows', async () => {
  const context = await start();
  await client.query(`INSERT INTO media_source_observations(library_id,media_server_id,external_id,identity_issue,generation)
    SELECT $1,$2,'seed-'||n,'invalid_provider_ids',$3 FROM generate_series(1,$4) n`,
  [libraryId, serverId, context.generation, SOURCE_OBSERVATION_LIMITS.retainedPerLibrary]);
  await store.capture(context, [conflict('new'), conflict('seed-1', { title: 'Refreshed' })]);
  expect(await summary()).toMatchObject({ retainedCount: 20000, capture: { omittedCount: 1 }, examples: expect.any(Array) });
  expect((await summary()).examples).toHaveLength(5);
  expect((await rows()).find(r => r.external_id === 'seed-1').title).toBe('Refreshed');
});

test('rejects mismatched library ownership and preserves source data on provider failure', async () => {
  await expect(store.start(serverId + 1, libraryId)).rejects.toThrow('Source capture library is unavailable');
  expect(await rows()).toHaveLength(0);
});
