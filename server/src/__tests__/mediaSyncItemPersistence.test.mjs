/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { persistSyncedMediaItem } from '../services/mediaSyncItemPersistence.mjs';
import { createTmdbIdentityOrigin } from '../services/mediaSourceIdentity.mjs';

const item = () => ({ external_id: 'key', media_type: 'movie', title: 'Source', year: 2001,
  genres: ['Drama'], tags: [], collections: [], metadata: { summary: 'Original' } });
const analyze = jest.fn().mockResolvedValue({ analyzed: false });
beforeEach(() => analyze.mockClear());

test('recomputes from a concurrent resolution instead of erasing it', async () => {
  const resolved = { ...item(), media_server_id: 1, tmdb_id: 42, source_revision: '22' };
  resolved.metadata.tmdb_identity_origin = createTmdbIdentityOrigin(resolved, 42, 'queue_resolution');
  const query = jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rowCount: 0 })
    .mockResolvedValueOnce({ rows: [resolved] }).mockResolvedValueOnce({ rowCount: 1 });
  expect(await persistSyncedMediaItem(1, 2, item(), { query, analyze })).toBe('synced');
  expect(query.mock.calls[1][1][3]).toBeNull();
  expect(query.mock.calls[3][1][3]).toBe(42);
  expect(query.mock.calls[3][1][17]).toBe('22');
  expect(analyze).toHaveBeenCalledTimes(1);
});

test('bounds contention without an unconditional overwrite', async () => {
  const query = jest.fn().mockImplementation(async sql => sql.startsWith('SELECT') ? { rows: [] } : { rowCount: 0 });
  expect(await persistSyncedMediaItem(1, 2, item(), { query, analyze })).toBe('concurrent_source_change');
  expect(query).toHaveBeenCalledTimes(6);
});

test('captures caller input and strips forged provenance before asynchronous analysis', async () => {
  const incoming = item();
  incoming.metadata.tmdb_identity_origin = { version: 1 };
  const before = structuredClone(incoming);
  const query = jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rowCount: 1 });
  const analyzeItem = jest.fn().mockImplementation(async () => {
    incoming.title = 'Changed'; incoming.genres.push('Action'); incoming.metadata.summary = 'Changed';
    return { analyzed: true, bestMatch: { type: 'movie', confidence: 75 } };
  });
  expect(await persistSyncedMediaItem(1, 2, incoming, { query, analyze: analyzeItem })).toBe('synced');
  const values = query.mock.calls[1][1];
  expect(values[6]).toBe(before.title);
  expect(values[10]).toEqual(['Drama']);
  expect(JSON.parse(values[16])).toEqual({ summary: 'Original',
    content_analysis: { type: 'movie', confidence: 75, detected_at: expect.any(String) } });
  expect(incoming.metadata.content_analysis).toBeUndefined();
});

test.each([{ tmdb_id: '12bad' }, { imdb_id: 'wrong' }, { media_type: 'person' },
  { external_id: '' }, { external_id: 42 }, { provider_identity_invalid: true }])('skips invalid source input: %j', patch => {
  const query = jest.fn();
  return expect(persistSyncedMediaItem(1, 2, { ...item(), ...patch }, { query, analyze }))
    .resolves.toBe('invalid_source_identity').then(() => {
      expect(query).not.toHaveBeenCalled(); expect(analyze).not.toHaveBeenCalled();
    });
});

test('rejects invalid server IDs and propagates database failures', async () => {
  const query = jest.fn().mockRejectedValue(new Error('offline'));
  expect(await persistSyncedMediaItem(0, 2, item(), { query, analyze })).toBe('invalid_source_identity');
  await expect(persistSyncedMediaItem(1, 2, item(), { query, analyze })).rejects.toThrow('offline');
});
