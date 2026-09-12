/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL, readLiveInventoryDescriptionCorpus } from '../../services/liveInventoryDescriptionCorpus.mjs';
import { buildInventoryDescriptionCorpusSql, INVENTORY_DESCRIPTION_CORPUS_SQL } from '../../services/inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../../services/sourceConflictAuthorityGuard.mjs';

const request = { key: 'movie:90', mediaType: 'movie', libraryIds: [1, 2] };
const row = (library, media = 'movie') => ({ tmdb_id: 1, library_id: library, media_type: media, overview: 'Example' });

test.each(['movie', 'tv'])('binds %s to SQL and retains memberships outside the shortlist', async mediaType => {
  const rows = [row(1, mediaType), row(99, mediaType)];
  const client = { query: jest.fn(async () => ({ rows })) };
  const result = await readLiveInventoryDescriptionCorpus(client, { ...request, mediaType, key: `${mediaType}:90` });
  expect(client.query).toHaveBeenCalledWith(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL,
    [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, mediaType]);
  expect(result.rows).toBe(rows);
  expect(result.corpus.documents[0].libraryIds).toEqual([1, 99]);
  expect(client.query.mock.calls[0][1]).toHaveLength(2);
});

test('scoped SQL filters before ordering/limits and leaves all-media consumers unchanged', () => {
  expect(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL).toContain('AND msi.media_type = $2::text');
  expect(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL.indexOf('msi.media_type = $2::text'))
    .toBeLessThan(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL.lastIndexOf('ORDER BY'));
  expect(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL).toContain('LIMIT 50001');
  expect(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL).toContain('NOT EXISTS');
  expect(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL).toContain('source_conflict.last_seen_at');
  expect(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL).toContain('l.is_active = true AND l.media_type = msi.media_type');
  expect(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL.replace('AND msi.media_type = $2::text ', ''))
    .toBe(buildInventoryDescriptionCorpusSql({ includeCandidateMetadata: true }));
  expect(INVENTORY_DESCRIPTION_CORPUS_SQL).toBe(buildInventoryDescriptionCorpusSql());
  expect(INVENTORY_DESCRIPTION_CORPUS_SQL).not.toContain('$2');
  expect(buildInventoryDescriptionCorpusSql({ includeCandidateMetadata: true, includeEvaluationMetadata: true })).not.toContain('$2');
});

test.each([undefined, null, {}, { mediaType: null }, { mediaType: 'MOVIE' }, { mediaType: ['movie'] },
  { mediaType: "movie' OR true --" }, { key: 'tv:90' }, { key: 'movie:0' }, { key: 'movie:01' },
  { key: 'movie:-1' }, { key: 'movie:2147483648' }, { key: 'movie:90:extra' }, { key: 'movie:NaN' },
  { key: 'movie:' + '9'.repeat(20) }, { key: 90 }, { key: null }])('rejects missing, malformed or inconsistent scope before SELECT: %j', invalid => {
  const client = { query: jest.fn() };
  const input = invalid == null ? invalid : { ...request, ...invalid };
  if (invalid && Object.keys(invalid).length === 0) delete input.mediaType;
  return expect(readLiveInventoryDescriptionCorpus(client, input)).rejects.toThrow().then(() => {
    expect(client.query).not.toHaveBeenCalled();
  });
});

test.each([undefined, null, [row(1), row(2, 'tv')], [null]])('rejects unscoped or malformed returned rows: %j', rows => {
  return expect(readLiveInventoryDescriptionCorpus({ query: async () => ({ rows }) }, request)).rejects.toThrow('scope_changed');
});

test.each(['key', 'mediaType'])('rejects scope mutation during the database read: %s', field => {
  const input = { ...request };
  return expect(readLiveInventoryDescriptionCorpus({ query: async () => {
    input[field] = field === 'key' ? 'movie:91' : 'tv'; return { rows: [row(1)] };
  } }, input)).rejects.toThrow('scope_changed');
});

test('cancellation before or after the read and database failures never yield corpus evidence', async () => {
  const controller = new AbortController(); controller.abort();
  const client = { query: jest.fn() };
  await expect(readLiveInventoryDescriptionCorpus(client, request, controller.signal)).rejects.toThrow();
  expect(client.query).not.toHaveBeenCalled();
  const later = new AbortController();
  await expect(readLiveInventoryDescriptionCorpus({ query: async () => {
    later.abort(); return { rows: [row(1)] };
  } }, request, later.signal)).rejects.toThrow();
  await expect(readLiveInventoryDescriptionCorpus({ query: async () => { throw new Error('database unavailable'); } }, request))
    .rejects.toThrow('database unavailable');
});

test('same-media row and unique-description budgets remain enforced', async () => {
  await expect(readLiveInventoryDescriptionCorpus({ query: async () => ({ rows: Array(50001).fill(row(1)) }) }, request))
    .rejects.toThrow('corpus_limit_exceeded');
  const rows = Array.from({ length: 10001 }, (_, index) => ({ ...row(1), tmdb_id: index + 1, overview: `Unique ${index}` }));
  await expect(readLiveInventoryDescriptionCorpus({ query: async () => ({ rows }) }, request))
    .rejects.toThrow('document_limit_exceeded');
});
