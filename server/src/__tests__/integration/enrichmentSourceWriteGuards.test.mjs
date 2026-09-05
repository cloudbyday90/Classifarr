/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { jest, beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { prepareQueueEnrichmentPayload } from '../../services/queueEnrichmentPayload.mjs';
import { persistOmdbRating, persistEnrichmentMetadata } from '../../services/queueEnrichmentPersistence.mjs';
import { QueueOmdbEnrichmentService } from '../../services/queueOmdbEnrichmentService.mjs';
import { QueueClassificationHistoryService } from '../../services/queueClassificationHistoryService.mjs';
import { processMetadataEnrichmentTask } from '../../services/queueTaskProcessorEnrichment.mjs';

let pool, query, serverId, libraryIds, itemId, logger;
beforeEach(async () => {
  pool = getPool(); query = (sql, values) => pool.query(sql, values);
  serverId = (await query(`INSERT INTO media_server (type, name, url, api_key)
    VALUES ('plex', $1, 'http://fixture.invalid', 'fixture-only') RETURNING id`, [randomUUID()])).rows[0].id;
  libraryIds = [];
  for (let i = 0; i < 2; i++) libraryIds.push((await query(`INSERT INTO libraries (name, external_id, media_type)
    VALUES ($1, $2, 'movie') RETURNING id`, [randomUUID(), randomUUID()])).rows[0].id);
  itemId = (await query(`INSERT INTO media_server_items
    (media_server_id, library_id, external_id, title, year, media_type, imdb_id, tvdb_id, content_rating, metadata)
    VALUES ($1, $2, $3, 'Captured source', 2001, 'movie', 'tt123', 7, 'G', '{}') RETURNING id`,
  [serverId, libraryIds[0], randomUUID()])).rows[0].id;
  logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
});
afterEach(async () => {
  await query('DELETE FROM classification_history WHERE library_id = ANY($1::int[])', [libraryIds]);
  await query('DELETE FROM media_server_items WHERE id = $1', [itemId]);
  await query('DELETE FROM media_server WHERE id = $1', [serverId]);
  await query('DELETE FROM libraries WHERE id = ANY($1::int[])', [libraryIds]);
});
const stored = async () => (await query('SELECT * FROM media_server_items WHERE id = $1', [itemId])).rows[0];
const prepare = () => prepareQueueEnrichmentPayload({ itemId, media_type: 'movie' }, query);
const historyCount = async () => (await query('SELECT count(*)::int AS count FROM classification_history WHERE library_id = ANY($1::int[])', [libraryIds])).rows[0].count;
const changes = {
  title: "UPDATE media_server_items SET title = 'Replacement' WHERE id = $1",
  year: 'UPDATE media_server_items SET year = 2002 WHERE id = $1',
  imdb_id: "UPDATE media_server_items SET imdb_id = 'tt999' WHERE id = $1",
  tvdb_id: 'UPDATE media_server_items SET tvdb_id = 9 WHERE id = $1',
  media_server_id: 'UPDATE media_server_items SET media_server_id = NULL WHERE id = $1',
  external_id: "UPDATE media_server_items SET external_id = 'Replaced key' WHERE id = $1",
  library_id: 'UPDATE media_server_items SET library_id = $2 WHERE id = $1',
  media_type: "UPDATE media_server_items SET media_type = 'tv' WHERE id = $1",
  tmdb_id: 'UPDATE media_server_items SET tmdb_id = 99 WHERE id = $1',
  deleted: 'DELETE FROM media_server_items WHERE id = $1',
};
async function change(field) {
  await query(changes[field], field === 'library_id' ? [itemId, libraryIds[1]] : [itemId]);
}
function deps() {
  const history = new QueueClassificationHistoryService({ db: { query }, logger });
  jest.spyOn(history, 'persist');
  return { db: { query }, queryWithTimeout: query, logger,
    metadataEnrichment: { hasWebSearchEnrichmentMetadata: () => false },
    enrichmentItemStateService: { markProcessing: jest.fn(), syncItemState: jest.fn() },
    resolveSourceLibraryName: async (_id, name) => name,
    queueOmdbEnrichmentService: { enrich: jest.fn() }, queueWebSearchEnrichmentService: { enrich: jest.fn() },
    queueTmdbResolutionService: { resolveAndBackfill: jest.fn().mockImplementation(async (_payload, data, id) => {
      data.tmdb_resolution = { version: 1, status: id ? 'resolved' : 'review_required', reason: 'fixture' };
      return id;
    }) },
    queueInventoryTmdbEnrichmentService: { enrich: jest.fn().mockResolvedValue(false) },
    queueClassificationHistoryService: history, completeTask: jest.fn() };
}
const run = (dependencies, patch = {}) => processMetadataEnrichmentTask({ id: 1,
  payload: { itemId, media_type: 'movie', ...patch } }, dependencies);

test.each(Object.keys(changes))('rejects late OMDb rating after %s changes', async field => {
  const payload = await prepare();
  await change(field);
  const before = await stored();
  const omdb = new QueueOmdbEnrichmentService({ db: { query }, queryWithTimeout: query, logger });
  await omdb.maybeBackfillRating(itemId, { type: 'movie', rated: 'R' }, 'movie', payload.source_identity_snapshot, null);
  expect(await stored()).toEqual(before);
  expect(logger.info).not.toHaveBeenCalled();
});

test.each(Object.keys(changes))('rejects final unresolved metadata and stops history after %s changes', async field => {
  const dependencies = deps();
  dependencies.queueWebSearchEnrichmentService.enrich.mockImplementation(async () => change(field));
  await run(dependencies);
  expect((await stored())?.metadata ?? {}).toEqual({});
  expect(await historyCount()).toBe(0);
  expect(dependencies.queueClassificationHistoryService.persist).not.toHaveBeenCalled();
  expect(dependencies.completeTask).toHaveBeenCalledWith(1, { enriched: false, skipped: true, reason: 'source_identity_changed' });
  expect(dependencies.enrichmentItemStateService.syncItemState).toHaveBeenCalledWith(itemId);
});

test.each([null, 42])('allows bookkeeping and derives original rating atomically for TMDb %j', async tmdbId => {
  await query('UPDATE media_server_items SET tmdb_id = $2 WHERE id = $1', [itemId, tmdbId]);
  const payload = await prepare();
  await query(`UPDATE media_server_items SET content_rating = 'PG', last_synced = NOW(),
    metadata = '{"unrelated":true}' WHERE id = $1`, [itemId]);
  const result = await persistOmdbRating(query, itemId, 'R', 'movie', payload.source_identity_snapshot, tmdbId);
  expect(result).toMatchObject({ rowCount: 1, rows: [{ original_rating: 'PG' }] });
  await persistOmdbRating(query, itemId, 'PG-13', 'movie', payload.source_identity_snapshot, tmdbId);
  expect(await stored()).toMatchObject({ content_rating: 'PG-13', original_rating: 'PG', metadata: { unrelated: true } });
  const dependencies = deps();
  await run(dependencies);
  expect(await historyCount()).toBe(1);
  expect((await stored()).metadata.unrelated).toBe(true);
  expect(dependencies.completeTask).toHaveBeenCalledWith(1, expect.objectContaining({ enriched: true }));
  const metadata = (await query('SELECT metadata FROM classification_history WHERE library_id = $1', [libraryIds[0]])).rows[0].metadata;
  expect(metadata.source_identity_snapshot).toBeUndefined();
});

test('known TMDb identity cannot receive a late rating or metadata after ID removal', async () => {
  await query('UPDATE media_server_items SET tmdb_id = 42 WHERE id = $1', [itemId]);
  const payload = await prepare();
  await query('UPDATE media_server_items SET tmdb_id = NULL WHERE id = $1', [itemId]);
  expect((await persistOmdbRating(query, itemId, 'R', 'movie', payload.source_identity_snapshot, 42)).rowCount).toBe(0);
  expect((await persistEnrichmentMetadata(query, payload, 42, { stale: true }, false)).rowCount).toBe(0);
  expect(await stored()).toMatchObject({ content_rating: 'G', metadata: {} });
});

test.each(['title', 'tmdb_id', 'deleted'])('guards history when %s changes after metadata was saved', async field => {
  const dependencies = deps();
  dependencies.queryWithTimeout = async (sql, values) => {
    const result = await query(sql, values);
    await change(field);
    return result;
  };
  await run(dependencies);
  expect(dependencies.queueClassificationHistoryService.persist).toHaveBeenCalledTimes(1);
  expect(await historyCount()).toBe(0);
  expect(dependencies.completeTask).toHaveBeenCalledWith(1, { enriched: false, skipped: true, reason: 'source_identity_changed' });
});

test('observation-only refresh cannot update clocks or traits after source replacement', async () => {
  await query('UPDATE media_server_items SET tmdb_id = 42 WHERE id = $1', [itemId]);
  const dependencies = deps();
  dependencies.queueInventoryTmdbEnrichmentService.enrich.mockImplementation(async (_payload, data) => {
    await change('title');
    data.inventory_tmdb = { version: 1, tmdb_id: 42, media_type: 'movie', keywords: ['stale'] };
    return true;
  });
  await run(dependencies, { inventory_tmdb_only: true });
  expect(await stored()).toMatchObject({ metadata: {}, inventory_tmdb_attempted_at: null, inventory_tmdb_fetched_at: null });
  expect(await historyCount()).toBe(0);
  expect(dependencies.completeTask).toHaveBeenCalledWith(1, expect.objectContaining({ enriched: false, reason: 'source_identity_changed' }));
});

test.each(['rating', 'metadata', 'history'])('%s waits for a concurrent writer and rechecks the source', async kind => {
  const payload = await prepare();
  const writer = await pool.connect();
  const reader = await pool.connect();
  const readerQuery = (sql, values) => reader.query(sql, values);
  let pending;
  try {
    const pid = (await reader.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await writer.query('BEGIN');
    await writer.query(changes.title, [itemId]);
    pending = kind === 'rating'
      ? persistOmdbRating(readerQuery, itemId, 'R', 'movie', payload.source_identity_snapshot, null)
      : kind === 'metadata' ? persistEnrichmentMetadata(readerQuery, payload, null, { stale: true }, false)
        : new QueueClassificationHistoryService({ db: { query: readerQuery }, logger })
          .persist(payload, null, libraryIds[0], 'Source', 1);
    let blocked = false;
    for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
      blocked = (await query('SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked', [pid])).rows[0].blocked;
      if (!blocked) await delay(20);
    }
    expect(blocked).toBe(true);
    await writer.query('COMMIT');
    const result = await pending;
    if (kind === 'history') expect(result).toBe(false);
    else expect(result.rowCount).toBe(0);
    expect(await stored()).toMatchObject({ title: 'Replacement', content_rating: 'G', metadata: {} });
    expect(await historyCount()).toBe(0);
  } finally {
    try {
      await writer.query('ROLLBACK');
      if (pending) await pending;
    } finally { writer.release(); reader.release(); }
  }
});

test('history lock contention obeys the database statement timeout without a late insert', async () => {
  const payload = await prepare();
  const writer = await pool.connect();
  const reader = await pool.connect();
  try {
    await writer.query('BEGIN');
    await writer.query(changes.title, [itemId]);
    await reader.query("SET statement_timeout = '100ms'");
    const history = new QueueClassificationHistoryService({ db: { query: (sql, values) => reader.query(sql, values) }, logger });
    await expect(history.persist(payload, null, libraryIds[0], 'Source', 1)).rejects.toMatchObject({ code: '57014' });
    await writer.query('COMMIT');
    expect(await historyCount()).toBe(0);
  } finally {
    try { await writer.query('ROLLBACK'); await reader.query('RESET statement_timeout'); }
    finally { writer.release(); reader.release(); }
  }
});
