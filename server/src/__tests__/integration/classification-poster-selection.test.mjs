/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { classificationPosterPath, readClassificationPosterPath } from '../../services/classificationPosterSelection.mjs';
import { getImageStats, getPendingCount, getPendingBreakdown, getPendingEmbeddings } from '../../services/embeddingServiceQueries.mjs';

let client, serverId, movieLibrary, otherLibrary, tvLibrary, historyId, deps, embeddingDims;
const query = (...args) => client.query(...args);
const logger = { error: jest.fn() };
beforeEach(async () => {
  client = await getPool().connect(); await query('BEGIN'); logger.error.mockClear();
  const definition = (await query(`SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute
    WHERE attrelid='classification_embeddings'::regclass AND attname='embedding' AND NOT attisdropped`)).rows[0].type;
  embeddingDims = Number(definition.match(/^vector\((\d+)\)$/)?.[1]);
  expect(embeddingDims).toBeGreaterThan(0); expect(embeddingDims).toBeLessThanOrEqual(2000);
  serverId = (await query(`INSERT INTO media_server(type,name,url,api_key,is_active)
    VALUES ('plex',$1,'http://fixture.invalid','fixture',true) RETURNING id`, [randomUUID()])).rows[0].id;
  [movieLibrary, otherLibrary, tvLibrary] = (await query(`INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active)
    VALUES ('Movie A','a','movie',$1,true),('Movie B','b','movie',$1,true),('Series','c','tv',$1,true) RETURNING id`,
  [serverId])).rows.map(row => row.id);
  historyId = (await query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,metadata)
    VALUES (7,'movie','Synthetic',$1,'{}') RETURNING id`, [movieLibrary])).rows[0].id;
  deps = { db: { query }, logger };
});
afterEach(async () => {
  try { await query('ROLLBACK'); } finally { client.release(); }
  expect(logger.error).not.toHaveBeenCalled();
});
async function inventory(libraryId = movieLibrary, metadata = { posterPath: '/inventory.jpg' }, type = 'movie') {
  return (await query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,tmdb_id,metadata,last_synced)
    VALUES ($1,$2,$3,'Synthetic',$4,7,$5,'2026-01-01') RETURNING id,external_id`,
  [serverId, libraryId, randomUUID(), type, metadata])).rows[0];
}
const poster = () => readClassificationPosterPath(query, historyId);
const embedding = () => query(`INSERT INTO classification_embeddings(classification_id,embedding_dims,provider,model,embedding)
  VALUES ($1,$2,'fixture','fixture',array_fill(0::real,ARRAY[$2::integer])::vector)`, [historyId, embeddingDims]);

test('duplicate library memberships do not multiply counts or admitted work', async () => {
  await inventory(); await inventory(otherLibrary);
  expect(await getPendingCount(deps, {})).toBe(1);
  expect(await getPendingCount(deps, { includeImage: true })).toBe(1);
  expect(await getImageStats(deps)).toEqual({ total: 0, pending: 1 });
  expect(await getPendingBreakdown(deps)).toEqual({ text: 1, image: 0, total: 1 });
  expect(await getPendingEmbeddings(deps, { includeImage: true })).toHaveLength(1);
  await embedding();
  expect(await getPendingBreakdown(deps)).toEqual({ text: 0, image: 1, total: 1 });
  expect(await getPendingEmbeddings(deps, { includeImage: true })).toMatchObject([{ id: historyId, needsText: false, needsImage: true }]);
  await query('UPDATE classification_embeddings SET image_embedding=array_fill(0::real,ARRAY[2000])::vector WHERE classification_id=$1', [historyId]);
  expect(await getImageStats(deps)).toEqual({ total: 1, pending: 0 });
  expect(await getPendingCount(deps, { includeImage: true })).toBe(0);
  expect(logger.error).not.toHaveBeenCalled();
});

test('typed, active membership and positive identity are required for fallback', async () => {
  await inventory(tvLibrary, { poster_path: '/series.jpg' }, 'tv');
  expect(await poster()).toBeNull();
  await inventory(); expect(await poster()).toBe('/inventory.jpg');
  await query('UPDATE libraries SET is_active=false WHERE id=$1', [movieLibrary]);
  expect(await poster()).toBeNull();
  await query('UPDATE libraries SET is_active=true WHERE id=$1', [movieLibrary]);
  await query('UPDATE media_server SET is_active=false WHERE id=$1', [serverId]);
  expect(await poster()).toBeNull();
  await query('UPDATE media_server SET is_active=true WHERE id=$1', [serverId]);
  await query('UPDATE classification_history SET tmdb_id=NULL WHERE id=$1', [historyId]);
  expect(await poster()).toBeNull();
});

test('a retained conflict excludes that source without clearing or rewriting it', async () => {
  const item = await inventory(); await embedding();
  await query(`INSERT INTO media_source_capture_state(library_id,media_server_id,generation,mode,phase,source)
    VALUES ($1,$2,1,'full','complete','media_sync')`, [movieLibrary, serverId]);
  await query(`INSERT INTO media_source_observations(library_id,media_server_id,external_id,title,media_type,identity_issue,provider_fields,generation)
    VALUES ($1,$2,$3,'Synthetic','movie','conflicting_provider_ids',ARRAY['tmdb_id'],1)`,
  [movieLibrary, serverId, item.external_id]);
  const before = (await query('SELECT * FROM media_source_observations WHERE media_server_id=$1', [serverId])).rows;
  expect(await poster()).toBeNull();
  expect(await getPendingBreakdown(deps)).toEqual({ text: 0, image: 0, total: 0 });
  expect(await getPendingEmbeddings(deps, { includeImage: true })).toEqual([]);
  await inventory(otherLibrary, { poster_path: '/eligible.jpg' });
  expect(await poster()).toBe('/eligible.jpg');
  expect((await query('SELECT * FROM media_source_observations WHERE media_server_id=$1', [serverId])).rows).toEqual(before);
});

test('history artwork wins and otherwise newest eligible candidate has stable tie-breaking', async () => {
  const first = await inventory(); await inventory(otherLibrary, { poster_path: '/second.jpg' });
  expect(await poster()).toBe('/second.jpg');
  await query("UPDATE media_server_items SET last_synced='2026-02-01' WHERE id=$1", [first.id]);
  expect(await poster()).toBe('/inventory.jpg');
  await query('UPDATE classification_history SET metadata=$2 WHERE id=$1', [historyId, { poster_path: '/history.jpg' }]);
  expect(await poster()).toBe('/history.jpg');
});

test('pending pagination has a deterministic tie break and text-only reads need no artwork', async () => {
  const second = (await query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,metadata,created_at)
    VALUES (8,'movie','Second',$1,'{}','2026-01-01') RETURNING id`, [movieLibrary])).rows[0].id;
  await query("UPDATE classification_history SET created_at='2026-01-01' WHERE id=$1", [historyId]);
  expect(await getPendingCount(deps, {})).toBe(2);
  expect(await getPendingEmbeddings(deps, { limit: 1 })).toMatchObject([{ id: second }]);
  expect(await getImageStats(deps)).toEqual({ total: 0, pending: 0 });
});

test('a library/source-server mismatch cannot supply fallback artwork', async () => {
  await inventory();
  const other = (await query(`INSERT INTO media_server(type,name,url,api_key,is_active)
    VALUES ('jellyfin','Other','http://fixture.invalid','fixture',true) RETURNING id`)).rows[0].id;
  await query('UPDATE libraries SET media_server_id=$2 WHERE id=$1', [movieLibrary, other]);
  expect(await poster()).toBeNull();
});

test.each([
  { poster_path: '', posterPath: '/alternate.jpg' }, { poster_path: 7, posterPath: '/alternate.jpg' },
  { poster_path: { url: '/wrong.jpg' }, posterPath: '/alternate.jpg' }, { poster_path: [] },
  { poster_path: `/${'x'.repeat(4096)}` }, { poster_path: `/${'é'.repeat(2048)}` },
  { poster_path: ' \t\n\r\f\v/trimmed.jpg \t\n\r\f\v' }, { poster_path: '//fixture.invalid/a' },
  { poster_path: '/with space.jpg' }, { poster_path: 'javascript:alert(1)' },
  { poster_path: '/with\u00a0space.jpg' }, { poster_path: '/with\u0085control.jpg' },
  { poster_path: '/caf\u00e9.jpg' }, { poster_path: '/percent%20encoded.jpg' },
  ...['\u0001', '\u001f', '\u007f', '\u1680', '\u2000', '\u200a', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff']
    .map(separator => ({ poster_path: `/with${separator}separator.jpg` })),
  { poster_path: 'HTTP://fixture.invalid/a.jpg' }, { poster_path: null },
])('SQL and JS agree for history and inventory poster formats: %#', async metadata => {
  const expected = classificationPosterPath(metadata);
  await query('UPDATE classification_history SET metadata=$2 WHERE id=$1', [historyId, metadata]);
  expect(await poster()).toBe(expected);
  await query("UPDATE classification_history SET metadata='{}' WHERE id=$1", [historyId]);
  await inventory(movieLibrary, metadata); await embedding();
  expect(await poster()).toBe(expected);
  expect(await getPendingCount(deps, { includeText: false, includeImage: true })).toBe(expected ? 1 : 0);
  expect(await getPendingEmbeddings(deps, { includeText: false, includeImage: true })).toHaveLength(expected ? 1 : 0);
  expect(logger.error).not.toHaveBeenCalled();
});
