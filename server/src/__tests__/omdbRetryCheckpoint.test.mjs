/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createOmdbRetryCheckpoint, readOmdbRetryCheckpoint } from '../services/omdbRetryCheckpoint.mjs';
import { enrichWithOmdb } from '../services/enrichmentRetryOmdb.mjs';
import { OmdbAdmissionWaitError } from '../services/omdbPacingPolicy.mjs';
import { persistEnrichmentRetryResult } from '../services/enrichmentRetryResultPersistence.mjs';

const item = { media_server_id: 1, external_id: 'source', library_id: 1, media_type: 'movie',
  title: 'Private title', year: 2026, imdb_id: 'tt0000001', tvdb_id: null, tmdb_id: 42, queue_id: 1, media_item_id: 2 };
const context = { source: 'omdb', id: 1, generation: '879a6b9f-f343-402d-834b-040739c6411b' };

test('checkpoint is bounded, canonical, source-specific and expires without extending its age', () => {
  const now = Date.now(), checkpoint = createOmdbRetryCheckpoint(item, context, now);
  expect(JSON.stringify(checkpoint)).not.toMatch(/Private|tt0000001/);
  expect(readOmdbRetryCheckpoint(item, { ...checkpoint, secret: 'discard' }, now + 10)).toEqual(checkpoint);
  for (const change of [{ title: 'changed' }, { tmdb_id: 43 }, { library_id: 2 }, { media_type: 'tv' }, { imdb_id: null }]) {
    expect(readOmdbRetryCheckpoint({ ...item, ...change }, checkpoint, now)).toBeNull();
  }
  for (const value of [null, {}, { ...checkpoint, version: 2 }, { ...checkpoint, generation: 'invalid' },
    { ...checkpoint, observedAt: now + 1 }, { ...checkpoint, observedAt: now - 86400000 }]) {
    expect(readOmdbRetryCheckpoint(item, value, now)).toBeNull();
  }
  expect(createOmdbRetryCheckpoint(item, null)).toBeNull();
  expect(createOmdbRetryCheckpoint({ ...item, title: null }, context)).toBeNull();
  expect(createOmdbRetryCheckpoint({ ...item, tmdb_id: undefined }, context)).toBeNull();
  expect(createOmdbRetryCheckpoint({}, context)).toBeNull();
});
test('a paced second lookup resumes from the saved miss without repeating the IMDb request', async () => {
  const logger = { error: jest.fn(), warn: jest.fn() };
  const omdbService = { getByIMDBId: jest.fn(async (_id, _key, options) => { options.onNotFound(context); return null; }),
    getByTitle: jest.fn().mockRejectedValueOnce(new OmdbAdmissionWaitError(1)).mockResolvedValue({ title: 'Found' }) };
  const first = await enrichWithOmdb({ omdbService, logger }, item);
  expect(first).toMatchObject({ success: false, providerAdmissionWait: true, retryAfterSeconds: 1 });
  const restarted = await enrichWithOmdb({ omdbService, logger }, { ...item, omdb_lookup_checkpoint: first.omdbCheckpoint });
  expect(restarted).toEqual({ success: true, data: { title: 'Found' } });
  expect(omdbService.getByIMDBId).toHaveBeenCalledTimes(1);
  expect(omdbService.getByTitle.mock.calls[1][4].expectedCredentialContext).toEqual(context);
  expect(logger.warn).not.toHaveBeenCalled(); expect(logger.error).not.toHaveBeenCalled();
});
test('credential mismatch restarts without retaining the previous generation checkpoint', async () => {
  const omdbService = { getByIMDBId: jest.fn(), getByTitle: jest.fn().mockRejectedValue(
    Object.assign(new OmdbAdmissionWaitError(1), { code: 'OMDB_LOOKUP_RESTART' })) };
  const result = await enrichWithOmdb({ omdbService }, { ...item, omdb_lookup_checkpoint: createOmdbRetryCheckpoint(item, context) });
  expect(result).toMatchObject({ providerAdmissionWait: true, omdbCheckpoint: null });
  expect(omdbService.getByIMDBId).not.toHaveBeenCalled();
});
test('admission unavailability preserves a continuation and defers without provider failure logging', async () => {
  const checkpoint = createOmdbRetryCheckpoint(item, context);
  const omdbService = { getByIMDBId: jest.fn(), getByTitle: jest.fn().mockRejectedValue(
    Object.assign(new Error('OMDb quota is unavailable'), { code: 'OMDB_ADMISSION_UNAVAILABLE', retryAfterSeconds: 60 })) };
  const result = await enrichWithOmdb({ omdbService }, { ...item, omdb_lookup_checkpoint: checkpoint });
  expect(result).toEqual({ success: false, providerAdmissionWait: true, retryAfterSeconds: 60, omdbCheckpoint: checkpoint });
  expect(omdbService.getByIMDBId).not.toHaveBeenCalled();
});
test.each([true, false])('claim-scoped persistence preserves a checkpoint only for a current source (%s)', async current => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const checkpoint = createOmdbRetryCheckpoint(item, context);
  const deps = { queueForRetry: jest.fn(), enrichmentItemStateService: { syncItemState: jest.fn() } };
  await persistEnrichmentRetryResult(client, { attempts: 0 }, current, item, 'omdb',
    { success: false, providerAdmissionWait: true, retryAfterSeconds: 1, omdbCheckpoint: checkpoint }, deps);
  const update = client.query.mock.calls.find(([sql]) => sql.includes('SET omdb_lookup_checkpoint'));
  expect(update[1]).toEqual([item.queue_id, current ? JSON.stringify(checkpoint) : null]);
  expect(deps.queueForRetry).not.toHaveBeenCalled();
  expect(client.query.mock.calls.some(([sql]) => sql.includes('attempts = attempts + 1'))).toBe(false);
});
