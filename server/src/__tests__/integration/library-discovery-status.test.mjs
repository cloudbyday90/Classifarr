/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createLibraryDiscoveryStatusRepository } from '../../services/libraryDiscoveryStatusRepository.mjs';
import { presentLibraryDiscovery } from '../../services/libraryDiscoveryPresentation.mjs';
const db = createIntegrationDatabaseModuleMock(), repository = createLibraryDiscoveryStatusRepository(db);
let sourceId;
const source = async () => (await db.query('SELECT * FROM media_server WHERE id=$1', [sourceId])).rows[0];
const read = async () => presentLibraryDiscovery(await repository.read());
const success = async () => {
  const attempt = await repository.begin(await source());
  await repository.finish(attempt, { contract: 'jellyfin_virtual_folders', count: 2 });
  return read();
};
beforeEach(async () => {
  await db.query('UPDATE media_server SET is_active=false');
  sourceId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('jellyfin',$1,'http://synthetic.invalid','synthetic-key') RETURNING id", [randomUUID()])).rows[0].id;
});
afterEach(async () => { await db.query('DELETE FROM media_server WHERE id=$1', [sourceId]); });

test('new installations do not invent discovery from legacy last_sync; failure and recovery retain bounded evidence', async () => {
  await db.query('UPDATE media_server SET last_sync=NOW() WHERE id=$1', [sourceId]);
  expect(await read()).toMatchObject({ reason: 'not_recorded', lastSuccessAt: null });
  const good = await success();
  const attempt = await repository.begin(await source());
  expect(await read()).toMatchObject({ reason: 'checking', lastSuccessAt: good.lastSuccessAt });
  await repository.finish(attempt, { error: { response: { status: 403, data: 'secret' } }, contract: 'jellyfin_virtual_folders' });
  expect(await read()).toMatchObject({ reason: 'forbidden', httpStatus: 403, lastSuccessAt: good.lastSuccessAt, lastSuccessCount: 2 });
  expect(await success()).toMatchObject({ reason: 'complete', httpStatus: null, lastSuccessCount: 2 });
  const { rows } = await db.query('SELECT * FROM media_server_catalog_status WHERE media_server_id=$1', [sourceId]);
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toMatch(/secret|synthetic-key|synthetic.invalid/);
});
test.each(['api_key', 'url', 'type', 'is_active'])('%s change and reversal invalidate old attempts and successes (ABA)', async field => {
  const good = await success(), oldSource = await source(), attempt = await repository.begin(oldSource);
  const changes = {
    api_key: "UPDATE media_server SET api_key='rotated' WHERE id=$1",
    url: "UPDATE media_server SET url='http://changed.invalid' WHERE id=$1",
    type: "UPDATE media_server SET type='emby' WHERE id=$1",
    is_active: 'UPDATE media_server SET is_active=false WHERE id=$1',
  };
  await db.query(changes[field], [sourceId]);
  await db.query('UPDATE media_server SET api_key=$2,url=$3,type=$4,is_active=true WHERE id=$1', [sourceId, oldSource.api_key, oldSource.url, oldSource.type]);
  expect(Number((await source()).catalog_revision)).toBe(Number(oldSource.catalog_revision) + 2);
  await repository.finish(attempt, { count: 99 });
  expect(await read()).toMatchObject({ reason: 'configuration_changed', lastSuccessAt: null, lastSuccessCount: null });
  expect(await repository.begin(oldSource)).toBeNull();
  const fresh = await repository.begin(await source());
  expect(await read()).toMatchObject({ reason: 'checking', lastSuccessAt: null });
  await repository.finish(fresh, { count: 0 });
  expect(await read()).toMatchObject({ reason: 'complete', lastSuccessCount: 0 });
  expect((await read()).lastSuccessAt).not.toBe(good.lastSuccessAt);
});
test('display names, last_sync and attempted manual revision changes do not invalidate current evidence', async () => {
  const good = await success(), before = await source();
  await db.query("UPDATE media_server SET name='Renamed',last_sync=NOW(),catalog_revision=999 WHERE id=$1", [sourceId]);
  expect((await source()).catalog_revision).toBe(before.catalog_revision);
  expect(await read()).toEqual(good);
});
test('overlapping attempts and repeated completion cannot overwrite the latest result', async () => {
  const first = await repository.begin(await source()), second = await repository.begin(await source());
  await repository.finish(second, { count: 3 });
  const latest = await read();
  await repository.finish(first, { error: { response: { status: 401 } } });
  await repository.finish(second, { error: { response: { status: 503 } } });
  expect(await read()).toEqual(latest);
});
test('unrecorded old attempt remains unknown, can recover, and is never treated as proof of a dead worker', async () => {
  await repository.begin(await source());
  await db.query("UPDATE media_server_catalog_status SET started_at=clock_timestamp()-INTERVAL '3 minutes' WHERE media_server_id=$1", [sourceId]);
  expect(await read()).toMatchObject({ reason: 'interrupted', lastSuccessAt: null });
  expect(await success()).toMatchObject({ reason: 'complete' });
});
test('inactive or removed sources reject late completion; cascade leaves no orphan diagnostics', async () => {
  const attempt = await repository.begin(await source());
  await db.query('UPDATE media_server SET is_active=false WHERE id=$1', [sourceId]);
  await repository.finish(attempt, { count: 5 });
  expect(await read()).toMatchObject({ reason: 'not_configured' });
  await db.query('DELETE FROM media_server WHERE id=$1', [sourceId]);
  await repository.finish(attempt, { count: 5 });
  expect((await db.query('SELECT * FROM media_server_catalog_status WHERE media_server_id=$1', [sourceId])).rows).toEqual([]);
});
test('count and database constraints reject invalid diagnostics', async () => {
  const attempt = await repository.begin(await source());
  for (const count of [null, -1, 1001, 1.5, '2']) await expect(repository.finish(attempt, { count })).rejects.toThrow('count_invalid');
  await expect(db.query("UPDATE media_server_catalog_status SET reason='secret' WHERE media_server_id=$1", [sourceId])).rejects.toMatchObject({ code: '23514' });
  await expect(db.query('UPDATE media_server_catalog_status SET last_success_count=3 WHERE media_server_id=$1', [sourceId])).rejects.toMatchObject({ code: '23514' });
  await repository.finish(attempt, { count: 0, contract: 'secret' });
  expect(await read()).toMatchObject({ contract: 'unknown', lastSuccessCount: 0 });
});
