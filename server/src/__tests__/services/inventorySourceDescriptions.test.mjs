/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { expect, jest, test } from '@jest/globals';
import { inventorySourceDescriptionKey, inventoryDescriptionQueryAliases } from '../../services/inventorySourceDescriptionIdentity.mjs';
import { prepareInventoryDescriptionCorpus, buildInventoryDescriptionCorpusSql } from '../../services/inventoryDescriptionCorpus.mjs';
import { inventoryDescriptionQueryExcludedHashes } from '../../services/inventoryDescriptionQueryExclusions.mjs';
import { buildLiveInventoryLearnedProfiles } from '../../services/liveInventoryLearnedProfile.mjs';
import { readLiveInventoryDescriptionCorpus, LIVE_INVENTORY_DESCRIPTION_CALIBRATION_SQL } from '../../services/liveInventoryDescriptionCorpus.mjs';

const row = (overrides = {}) => ({ media_type: 'movie', library_id: 1, media_server_id: 2,
  external_id: 'private-source', tmdb_id: null, overview: 'Source description', genres: ['pattern a'], ...overrides });
const hash = text => createHash('sha256').update(text).digest('hex');
const prepare = rows => prepareInventoryDescriptionCorpus(rows, { includeSourceItems: true });
const request = { key: 'movie:99', mediaType: 'movie', hash: hash('Query'), libraryIds: [1, 2],
  queryMetadata: { genres: ['pattern a'] } };

test('source identities are private, scoped, exact, and do not replace existing TMDB keys', () => {
  const input = row(), key = inventorySourceDescriptionKey(input);
  expect(key).toMatch(/^source:[a-f0-9]{64}$/);
  expect(key).not.toContain('private-source');
  expect(inventorySourceDescriptionKey(row({ title: 'A rename', library_name: 'Music' }))).toBe(key);
  for (const change of [{ library_id: 2 }, { media_server_id: 3 }, { media_type: 'tv' },
    { external_id: 'private-source ' }, { external_id: 'Private-source' }]) {
    expect(inventorySourceDescriptionKey(row(change))).not.toBe(key);
  }
  expect(inventorySourceDescriptionKey(row({ tmdb_id: 123 }))).toBe('movie:123');
  expect(inventorySourceDescriptionKey(row({ tmdb_id: undefined }))).toBe(key);
  expect(inventoryDescriptionQueryAliases(row({ library_id: '1', media_server_id: '2' })).sourceKey).toBe(key);
});

test.each([{ tmdb_id: 0 }, { tmdb_id: -1 }, { tmdb_id: '123' }, { tmdb_id: NaN },
  { tmdb_id: 2147483648 }, { tmdb_id: 1.5 }, { tmdb_id: '' }, { media_type: 'music' },
  { media_type: 'track' }, { media_type: 'MOVIE' }, { media_type: null }, { library_id: 0 },
  { media_server_id: null }, { external_id: '' }, { external_id: '  ' },
  { external_id: 'x'.repeat(101) }, { external_id: {} }])('invalid source input cannot fall back to a work identity: %j', change => {
  expect(() => prepare([row(change)])).toThrow();
});

test('legacy callers remain TMDB-only, while opted-in corpora share normalized hashes without merging identities', () => {
  expect(() => prepareInventoryDescriptionCorpus([row()])).toThrow('identity_invalid');
  const rows = [row(), row({ external_id: 'copy', library_id: 2, overview: ' Source   description ' })];
  const corpus = prepare(rows);
  expect(corpus.documents).toHaveLength(2);
  expect(corpus.texts.size).toBe(1);
  expect(corpus.documents.map(doc => doc.libraryIds)).toEqual([[1], [2]]);
  expect(corpus.documents.every(doc => doc.id === null)).toBe(true);
  expect(prepare([...rows, row({ overview: 'Conflicting' })]).coverage.conflictingDescriptions).toBe(1);
  expect(prepare([row({ overview: null })]).coverage.missingDescriptions).toBe(1);
});

test('SQL source opt-in retains active movie/TV and source conflict guards without inventing IDs', () => {
  const sql = buildInventoryDescriptionCorpusSql({ includeSourceItems: true });
  expect(sql).toContain("msi.media_type IN ('movie', 'tv')");
  expect(sql).toContain('msi.tmdb_id IS NULL AND msi.media_server_id > 0');
  expect(sql).toContain('l.is_active = true AND l.media_type = msi.media_type');
  expect(sql).toContain('NOT EXISTS');
  expect(sql).toContain('source_conflict.external_id = msi.external_id');
  expect(sql).toContain('LIMIT 50001');
  expect(buildInventoryDescriptionCorpusSql()).not.toContain('msi.tmdb_id IS NULL');
});

test.each(['movie', 'tv'])('source-only %s metadata trains arbitrary libraries without copied-description votes', mediaType => {
  const rows = Array.from({ length: 60 }, (_, index) => row({ media_type: mediaType,
    external_id: String(index), library_id: index < 30 ? 1 : 2,
    overview: `Source description ${index}`, genres: [index < 30 ? 'pattern a' : 'pattern b'] }));
  const input = { ...request, key: `${mediaType}:99`, mediaType };
  const build = values => buildLiveInventoryLearnedProfiles({ rows: values, corpus: prepare(values), request: input });
  const result = build(rows);
  expect(result.get(1).trainingDescriptions).toBe(60);
  expect(result.get(1).relativeFit).toBeGreaterThan(0);
  expect(result.get(2).relativeFit).toBeLessThan(0);
  expect(build([...rows, { ...rows[0], external_id: 'copy' }]).get(1).relativeFit).toBe(result.get(1).relativeFit);
  expect(build([...rows].reverse())).toEqual(result);
});

test('query aliases exclude direct possible self evidence and every synopsis copy, never unrelated media', () => {
  const rows = [row({ tmdb_id: 99, imdb_id: 'tt123', tvdb_id: 50, overview: 'Stored query' }),
    row({ external_id: 'alias', imdb_id: 'tt123', overview: 'Old query' }),
    row({ external_id: 'other-alias', tvdb_id: 50, overview: 'TVDB query' }),
    row({ external_id: 'unrelated', overview: 'Unrelated' }),
    row({ external_id: 'tv', media_type: 'tv', imdb_id: 'tt123', overview: 'Other media' })];
  const held = inventoryDescriptionQueryExcludedHashes(rows, request);
  expect(held).toEqual(new Set(['Query', 'Stored query', 'Old query', 'TVDB query'].map(hash)));
  const profiles = buildLiveInventoryLearnedProfiles({ rows, corpus: prepare(rows), request });
  expect(profiles.get(1).trainingDescriptions).toBe(1);
  const aliasRequest = { ...request, identityAliases: inventoryDescriptionQueryAliases({ imdb_id: ' TT123 ', tvdb_id: '50' }) };
  expect(inventoryDescriptionQueryExcludedHashes(rows.slice(1), aliasRequest))
    .toEqual(new Set(['Query', 'Old query', 'TVDB query'].map(hash)));
  expect(inventoryDescriptionQueryExcludedHashes([rows[3]], { ...request,
    identityAliases: inventoryDescriptionQueryAliases(rows[3]) })).toEqual(new Set(['Query', 'Unrelated'].map(hash)));
  expect(inventoryDescriptionQueryAliases({ imdb_id: {}, tvdb_id: -1 })).toEqual({ imdbId: null, tvdbId: null, sourceKey: null });
});

test.each([{ matchLibraryId: 1 }, { neighborCalibration: true }])('calibration selects legacy admission before SQL limits: %j', mode => {
  const client = { query: jest.fn(async () => ({ rows: [] })) };
  return readLiveInventoryDescriptionCorpus(client, { ...request, ...mode }).then(result => {
    expect(client.query).toHaveBeenCalledWith(LIVE_INVENTORY_DESCRIPTION_CALIBRATION_SQL, [expect.any(Number), 'movie']);
    expect(LIVE_INVENTORY_DESCRIPTION_CALIBRATION_SQL).not.toContain('msi.tmdb_id IS NULL');
    expect(result.corpus.documents).toEqual([]);
  });
});

test.each(['matchLibraryId', 'neighborCalibration'])('changing the consumer mode during a snapshot fails closed: %s', field => {
  const input = { ...request };
  const client = { query: async () => { input[field] = field === 'matchLibraryId' ? 1 : true; return { rows: [row()] }; } };
  return expect(readLiveInventoryDescriptionCorpus(client, input)).rejects.toThrow('scope_changed');
});
