/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { prepareQueueEnrichmentPayload } from '../services/queueEnrichmentPayload.mjs';
import { QueueRefillService } from '../services/queueRefillService.mjs';
import { processMetadataEnrichmentTask } from '../services/queueTaskProcessorEnrichment.mjs';

const source = { media_type: 'tv', library_id: 2, library_name: 'Source', tmdb_id: 42, metadata: {} };
const taskPayload = () => ({ title: 'Example', media_type: ' TV ', itemId: 1, source_library_id: 2, tmdb_id: 42 });

test.each([
  {}, { media_type: 'person' }, { media_type: null },
  { media_type: 'movie', media: { media_type: 'tv' } },
  { media_type: 'tv', tmdbId: 99, tmdb_id: 42 },
  { media_type: 'tv', tmdb_id: 0 },
  { media_type: 'tv', itemId: '1; DROP TABLE libraries' },
])('invalid payload performs no source read: %j', async (payload) => {
  const query = jest.fn();
  expect(await prepareQueueEnrichmentPayload(payload, query)).toBeNull();
  expect(query).not.toHaveBeenCalled();
});

test.each([
  null, { ...source, media_type: 'movie' }, { ...source, media_type: null },
  { ...source, tmdb_id: 99 }, { ...source, tmdb_id: 'bad' },
  { ...source, library_id: 3 }, { ...source, library_id: null },
])('rejects absent or conflicting source identity: %j', async (row) => {
  expect(await prepareQueueEnrichmentPayload(taskPayload(), jest.fn().mockResolvedValue({ rows: row ? [row] : [] }))).toBeNull();
});

test('captures caller data before the source read and recovers IDs only from a matching record', async () => {
  const payload = { title: 'Original', itemId: '1', media: { media_type: ' TV ' }, genres: ['Drama'] };
  const query = jest.fn().mockImplementation(async () => {
    await Promise.resolve();
    payload.itemId = '2'; payload.media.media_type = 'movie'; payload.genres.push('Action');
    return { rows: [{ ...source, metadata: { posterPath: '/poster' } }] };
  });
  const prepared = await prepareQueueEnrichmentPayload(payload, query);
  expect(prepared).toMatchObject({ itemId: 1, tmdb_id: 42, source_library_id: 2,
    media: { media_type: 'tv' }, genres: ['Drama'], posterPath: '/poster' });
  expect(query.mock.calls[0][1]).toEqual([1]);
});

test('database errors propagate instead of becoming identity guesses', async () => {
  await expect(prepareQueueEnrichmentPayload(taskPayload(), jest.fn().mockRejectedValue(new Error('offline')))).rejects.toThrow('offline');
});

test('does not resurrect a queued TMDb ID after the current source lost it', async () => {
  const prepared = await prepareQueueEnrichmentPayload(taskPayload(),
    jest.fn().mockResolvedValue({ rows: [{ ...source, tmdb_id: null }] }));
  expect(prepared.tmdb_id).toBeNull();
});

test('replaces stale queued identifiers and caller-supplied provenance with current source fields', async () => {
  const current = { ...source, title: 'Current', year: 2001, imdb_id: 'tt123', tvdb_id: 7,
    media_server_id: 1, external_id: 'current-key' };
  const prepared = await prepareQueueEnrichmentPayload({ ...taskPayload(), title: 'Stale', year: 2002,
    imdb_id: 'tt999', tvdb_id: 8, source_identity_snapshot: { title: 'Forged' } },
  jest.fn().mockResolvedValue({ rows: [current] }));
  expect(prepared).toMatchObject({ title: 'Current', year: 2001, imdb_id: 'tt123', tvdb_id: 7,
    source_identity_snapshot: { media_server_id: 1, external_id: 'current-key', title: 'Current', year: 2001 } });
});

test('replaces legacy queued tags and guessed language with current attributable observations', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [{ ...source, tags: ['source tag'], metadata: {
    inventory_tmdb: { version: 1, tmdb_id: 42, media_type: 'tv', keywords: ['provider keyword'], original_language: 'ja' },
  } }] });
  const prepared = await prepareQueueEnrichmentPayload({ ...taskPayload(), keywords: ['source tag'], original_language: 'en' }, query);
  expect(prepared).toMatchObject({ keywords: ['provider keyword'], tags: ['source tag'], original_language: 'ja' });
});

test.each([null, undefined, '', 'person'])('refill cannot manufacture a movie from %j', (mediaType) => {
  expect(new QueueRefillService().buildMetadataEnrichmentPayload({ title: 'Example', media_type: mediaType })).toBeNull();
});

test('refill uses item type and filters unsupported types before its bounded limit', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [] });
  await new QueueRefillService({ db: { query } }).selectRefillCandidates();
  const sql = query.mock.calls[0][0];
  expect(sql).toContain('l.name as library_name, msi.media_type');
  expect(sql.indexOf("msi.media_type IN ('movie', 'tv')")).toBeLessThan(sql.indexOf('LIMIT'));
});

function flowDeps(row = source) {
  return {
    db: { query: jest.fn().mockResolvedValue({ rows: row ? [row] : [] }) },
    logger: { warn: jest.fn(), info: jest.fn() },
    metadataEnrichment: { hasWebSearchEnrichmentMetadata: () => false },
    enrichmentItemStateService: { markProcessing: jest.fn(), syncItemState: jest.fn() },
    resolveSourceLibraryName: async (_id, name) => name,
    queueOmdbEnrichmentService: { enrich: jest.fn() },
    queueWebSearchEnrichmentService: { enrich: jest.fn() },
    queueTmdbResolutionService: { resolveAndBackfill: jest.fn().mockResolvedValue(42) },
    queueInventoryTmdbEnrichmentService: { enrich: jest.fn().mockResolvedValue(false) },
    queueClassificationHistoryService: { persist: jest.fn() },
    queryWithTimeout: jest.fn().mockResolvedValue({ rowCount: 1 }),
    completeTask: jest.fn(),
  };
}

test.each([undefined, 'movie'])('invalid or stale task skips providers, metadata, and history: %s', async (declared) => {
  const deps = flowDeps();
  await processMetadataEnrichmentTask({ id: 7, payload: { ...taskPayload(), media_type: declared } }, deps);
  expect(deps.queueOmdbEnrichmentService.enrich).not.toHaveBeenCalled();
  expect(deps.queueWebSearchEnrichmentService.enrich).not.toHaveBeenCalled();
  expect(deps.queueTmdbResolutionService.resolveAndBackfill).not.toHaveBeenCalled();
  expect(deps.queryWithTimeout).not.toHaveBeenCalled();
  expect(deps.queueClassificationHistoryService.persist).not.toHaveBeenCalled();
  expect(deps.completeTask).toHaveBeenCalledWith(7, { enriched: false, skipped: true, reason: 'invalid_media_identity' });
  expect(deps.logger.warn).toHaveBeenCalledWith('Metadata enrichment skipped', { reason: 'invalid_media_identity' });
});

test('source drift at metadata update prevents history and a successful enrichment result', async () => {
  const deps = flowDeps();
  deps.queryWithTimeout.mockResolvedValue({ rowCount: 0 });
  await processMetadataEnrichmentTask({ id: 7, payload: taskPayload() }, deps);
  expect(deps.queryWithTimeout.mock.calls[0][1].slice(1, 7)).toEqual([1, 'tv', 2, 42, false, false]);
  expect(JSON.parse(deps.queryWithTimeout.mock.calls[0][1][7])).toMatchObject({ library_id: 2, media_type: 'tv' });
  expect(deps.queueClassificationHistoryService.persist).not.toHaveBeenCalled();
  expect(deps.completeTask).toHaveBeenCalledWith(7, { enriched: false, skipped: true, reason: 'source_identity_changed' });
  expect(deps.enrichmentItemStateService.syncItemState).toHaveBeenCalledWith(1);
});

test('source drift at history insertion prevents reporting complete enrichment', async () => {
  const deps = flowDeps();
  deps.queueClassificationHistoryService.persist.mockResolvedValue(false);
  await processMetadataEnrichmentTask({ id: 7, payload: taskPayload() }, deps);
  expect(deps.completeTask).toHaveBeenCalledWith(7, { enriched: false, skipped: true, reason: 'source_identity_changed' });
  expect(deps.enrichmentItemStateService.syncItemState).toHaveBeenCalledWith(1);
});
