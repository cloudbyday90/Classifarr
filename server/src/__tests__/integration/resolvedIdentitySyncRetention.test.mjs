/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest, beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { persistSyncedMediaItem } from '../../services/mediaSyncItemPersistence.mjs';
import { prepareQueueEnrichmentPayload } from '../../services/queueEnrichmentPayload.mjs';
import { QueueTmdbResolutionService } from '../../services/queueTmdbResolutionService.mjs';
import { createMediaIdentityReviewService } from '../../services/mediaIdentityReviewService.mjs';

let pool, serverId, libraryIds, incoming, query, analyze, resolver, provider;
beforeEach(async () => {
  pool = getPool();
  query = (sql, values) => pool.query(sql, values);
  serverId = (await query(`INSERT INTO media_server (type, name, url, api_key)
    VALUES ('plex', $1, 'http://fixture.invalid', 'fixture-only') RETURNING id`, [randomUUID()])).rows[0].id;
  libraryIds = [];
  for (let i = 0; i < 2; i++) libraryIds.push((await query(`INSERT INTO libraries (name, external_id, media_type)
    VALUES ($1, $2, 'movie') RETURNING id`, [randomUUID(), randomUUID()])).rows[0].id);
  incoming = { external_id: randomUUID(), title: 'Stable source', year: 2001, media_type: 'movie',
    imdb_id: 'tt123', content_rating: 'TV-14', genres: ['Drama'], metadata: { summary: 'Source synopsis' } };
  analyze = jest.fn().mockResolvedValue({ analyzed: false });
  provider = { findIdentityByExternalId: jest.fn().mockResolvedValue({ movie_results: [{ id: 42 }], tv_results: [{ id: 42 }] }) };
  resolver = new QueueTmdbResolutionService({ queryWithTimeout: query, tmdbService: provider,
    logger: { info() {}, debug() {} } });
});
afterEach(async () => {
  await query('DELETE FROM media_server WHERE id = $1', [serverId]);
  await query('DELETE FROM libraries WHERE id = ANY($1::int[])', [libraryIds]);
});
const sync = (item = incoming, libraryId = libraryIds[0], dbQuery = query) =>
  persistSyncedMediaItem(serverId, libraryId, item, { query: dbQuery, analyze });
async function stored() {
  return (await query('SELECT *, xmin::text AS revision FROM media_server_items WHERE media_server_id = $1 AND external_id = $2',
    [serverId, incoming.external_id])).rows[0];
}
async function resolve() {
  const row = await stored();
  const payload = await prepareQueueEnrichmentPayload({ itemId: row.id, media_type: row.media_type,
    title: 'Stale queued title', year: 1990, imdb_id: 'tt999' }, query);
  await resolver.resolveAndBackfill(payload, {});
  return stored();
}
async function enrich() {
  const row = await resolve();
  await query(`UPDATE media_server_items SET metadata = metadata || $2::jsonb,
    inventory_tmdb_attempted_at = NOW(), inventory_tmdb_fetched_at = NOW(),
    original_rating = content_rating, content_rating = 'PG-13' WHERE id = $1`, [row.id, JSON.stringify({
    omdb: { data: { rated: 'PG-13' } }, inventory_tmdb: { version: 1, tmdb_id: 42,
      media_type: row.media_type, keywords: ['space'], original_language: 'ja' },
  })]);
  return stored();
}

test.each(['movie', 'tv'])('retains resolved %s identity, rating and observation clocks through repeated omissions', async type => {
  incoming.media_type = type;
  await sync(); const before = await enrich();
  const revision = (await query('SELECT revision::text FROM library_profile_inventory_state WHERE library_id = $1', [libraryIds[0]])).rows[0].revision;
  for (let i = 0; i < 3; i++) expect(await sync()).toBe('synced');
  const after = await stored();
  expect(after).toMatchObject({ tmdb_id: 42, content_rating: 'PG-13', original_rating: 'TV-14',
    metadata: { tmdb_identity_origin: { version: 1, method: 'queue_resolution', tmdb_id: 42, media_type: type },
      inventory_tmdb: before.metadata.inventory_tmdb } });
  expect(after.inventory_tmdb_fetched_at).toEqual(before.inventory_tmdb_fetched_at);
  expect(after.inventory_tmdb_attempted_at).toEqual(before.inventory_tmdb_attempted_at);
  expect((await query('SELECT revision::text FROM library_profile_inventory_state WHERE library_id = $1', [libraryIds[0]])).rows[0].revision).toBe(revision);
  expect(provider.findIdentityByExternalId).toHaveBeenCalledWith('tt123', 'imdb_id');
  expect(provider.findIdentityByExternalId).toHaveBeenCalledTimes(1);
});

test.each([{ title: 'Reused key' }, { title: 'Reused key', tmdb_id: 42 }, { year: 2002 },
  { imdb_id: 'tt999' }, { media_type: 'tv' }, { tmdb_id: 99 }])(
  'discards stale enrichment and resets observation clocks on changed source: %j', async patch => {
    await sync(); await enrich();
    expect(await sync({ ...incoming, ...patch })).toBe('synced');
    const after = await stored();
    expect(after).toMatchObject({ tmdb_id: patch.tmdb_id ?? null, media_type: patch.media_type ?? 'movie',
      content_rating: 'TV-14', original_rating: null, metadata: incoming.metadata,
      inventory_tmdb_attempted_at: null, inventory_tmdb_fetched_at: null });
  });

test('keeps the typed identity through a library move and dirties both library observations', async () => {
  await sync(); await enrich();
  const before = (await query('SELECT library_id, revision::text FROM library_profile_inventory_state WHERE library_id = ANY($1::int[]) ORDER BY library_id', [libraryIds])).rows;
  await sync(incoming, libraryIds[1]);
  expect(await stored()).toMatchObject({ library_id: libraryIds[1], tmdb_id: 42 });
  const after = (await query('SELECT library_id, revision::text FROM library_profile_inventory_state WHERE library_id = ANY($1::int[]) ORDER BY library_id', [libraryIds])).rows;
  expect(BigInt(after[0].revision)).toBe(BigInt(before[0].revision) + 1n);
  expect(after[1].revision).toBe('1');
});

test('does not grandfather a legacy ID or trust incoming provenance', async () => {
  await sync({ ...incoming, tmdb_id: 42 });
  await sync({ ...incoming, metadata: { tmdb_identity_origin: { version: 1, tmdb_id: 42 },
    tmdb_resolution: { status: 'resolved' }, inventory_tmdb: { version: 1, tmdb_id: 42 } } });
  expect(await stored()).toMatchObject({ tmdb_id: null, metadata: {} });
  await resolve(); await sync();
  expect((await stored()).tmdb_id).toBe(42);
});

test('rejects malformed IDs without changing stored identity or row revision', async () => {
  await sync(); const before = await enrich();
  expect(await sync({ ...incoming, tmdb_id: '42suffix' })).toBe('invalid_source_identity');
  expect(await sync({ ...incoming, provider_identity_invalid: true })).toBe('invalid_source_identity');
  expect(await stored()).toEqual(before);
});

test.each(['title', 'year', 'imdb_id', 'tvdb_id', 'media_server_id', 'library_id', 'external_id', 'media_type'])('rejects a late provider result after %s changes', async field => {
  await sync();
  const row = await stored();
  const statements = {
    title: "UPDATE media_server_items SET title = 'Changed' WHERE id = $1",
    year: 'UPDATE media_server_items SET year = 2002 WHERE id = $1',
    imdb_id: "UPDATE media_server_items SET imdb_id = 'tt999' WHERE id = $1",
    tvdb_id: 'UPDATE media_server_items SET tvdb_id = 7 WHERE id = $1',
    media_server_id: 'UPDATE media_server_items SET media_server_id = NULL WHERE id = $1',
    library_id: 'UPDATE media_server_items SET library_id = NULL WHERE id = $1',
    external_id: "UPDATE media_server_items SET external_id = 'Changed' WHERE id = $1",
    media_type: "UPDATE media_server_items SET media_type = 'tv' WHERE id = $1",
  };
  provider.findIdentityByExternalId.mockImplementation(async () => {
    await query(statements[field], [row.id]); return { movie_results: [{ id: 42 }] };
  });
  await resolve();
  const after = (await query('SELECT tmdb_id, metadata FROM media_server_items WHERE id = $1', [row.id])).rows[0];
  expect(after.tmdb_id).toBeNull();
  expect(after.metadata.tmdb_identity_origin).toBeUndefined();
});

test('allows unrelated rating updates while resolving and commits provenance atomically', async () => {
  await sync(); const row = await stored();
  provider.findIdentityByExternalId.mockImplementation(async () => {
    await query("UPDATE media_server_items SET content_rating = 'PG' WHERE id = $1", [row.id]);
    return { movie_results: [{ id: 42 }] };
  });
  expect(await resolve()).toMatchObject({ tmdb_id: 42, content_rating: 'PG', metadata: {
    tmdb_identity_origin: { source_anchor: { title: 'stable source', imdb_id: 'tt123' } },
  } });
});

test.each(['insert', 'update'])('retries a concurrent %s and retains the newly resolved identity', async mode => {
  if (mode === 'update') await sync();
  let raced = false;
  const racingQuery = async (sql, values) => {
    if (sql.startsWith('INSERT INTO media_server_items') && !raced) {
      raced = true;
      if (mode === 'insert') await sync();
      await enrich();
    }
    return query(sql, values);
  };
  expect(await sync(incoming, libraryIds[0], racingQuery)).toBe('synced');
  expect(await stored()).toMatchObject({ tmdb_id: 42, metadata: { tmdb_identity_origin: { tmdb_id: 42 } } });
});

test('bounded CAS retries leave the concurrent writer intact', async () => {
  await sync(); const before = await enrich();
  let attempts = 0;
  const racingQuery = async (sql, values) => {
    if (sql.startsWith('INSERT INTO media_server_items')) {
      attempts++;
      await query(`UPDATE media_server_items SET metadata = metadata || jsonb_build_object('concurrent', $2::int) WHERE id = $1`, [before.id, attempts]);
    }
    return query(sql, values);
  };
  expect(await sync({ ...incoming, title: 'Never persisted' }, libraryIds[0], racingQuery)).toBe('concurrent_source_change');
  expect(attempts).toBe(3);
  expect(await stored()).toMatchObject({ title: incoming.title, tmdb_id: 42, metadata: { concurrent: 3 } });
});

test('administrator confirmation records retention provenance in the audited transaction', async () => {
  await sync(); const row = await stored();
  await query(`UPDATE media_server_items SET metadata = metadata || '{"tmdb_resolution":{"version":1,"status":"review_required"}}' WHERE id = $1`, [row.id]);
  const actor = (await query("INSERT INTO users (username, password_hash, role) VALUES ($1, 'fixture', 'admin') RETURNING id", [randomUUID()])).rows[0].id;
  const db = { query, withTransaction: async fn => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } };
  try {
    const service = createMediaIdentityReviewService({ db, getIdentityDetails: async () => ({ id: 42, title: 'Candidate' }) });
    const source = (await service.list(actor)).items.find(item => item.id === row.id);
    const preview = await service.preview(actor, row.id, { tmdbId: 42, sourceVersion: source.sourceVersion });
    await service.confirm(actor, row.id, { previewId: preview.previewId, confirmed: true });
    await sync();
    expect(await stored()).toMatchObject({ tmdb_id: 42, metadata: { tmdb_identity_origin: { method: 'operator' },
      tmdb_resolution: { method: 'operator', review_id: preview.previewId } } });
    expect((await query('SELECT count(*)::int AS count FROM audit_log WHERE user_id = $1', [actor])).rows[0].count).toBe(1);
  } finally {
    await query('DELETE FROM audit_log WHERE user_id = $1', [actor]);
    await query('DELETE FROM users WHERE id = $1', [actor]);
  }
});
