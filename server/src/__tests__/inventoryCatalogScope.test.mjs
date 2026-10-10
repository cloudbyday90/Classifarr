/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { inventoryCatalogScopeKey, inventoryCatalogScopeMatches, isWholeWorkInventoryDescription } from '../services/inventoryCatalogScope.mjs';
import { prepareInventoryDescriptionCorpus } from '../services/inventoryDescriptionCorpus.mjs';
import { inventoryDescriptionQueryExcludedHashes } from '../services/inventoryDescriptionQueryExclusions.mjs';

const season = (series = 10, number = 1) => ({ media_type: 'tv', tmdb_id: null, library_id: 1,
  media_server_id: 2, external_id: 'group', overview: `Season ${number} description`,
  catalog_scope: { kind: 'season', tmdbSeriesId: series, seasonNumber: number } });
test('season identity remains distinct from a whole work and from other seasons', () => {
  const rows = [season(), season(10, 2), { media_type: 'tv', tmdb_id: 10, library_id: 1, overview: 'Parent description' }];
  expect(prepareInventoryDescriptionCorpus(rows, { includeSourceItems: true }).documents.map(doc => doc.key))
    .toEqual(['tv:10:season:1', 'tv:10:season:2', 'tv:10']);
  expect(isWholeWorkInventoryDescription(rows[0])).toBe(false);
  expect(isWholeWorkInventoryDescription(rows[2])).toBe(true);
  expect(() => prepareInventoryDescriptionCorpus([rows[0]])).toThrow('whole_work_required');
});
test.each([
  { tmdb_id: 10 }, { media_type: 'movie' }, { catalog_scope: {} },
  { catalog_scope: { kind: 'season', tmdbSeriesId: 0, seasonNumber: 1 } },
  { catalog_scope: { kind: 'season', tmdbSeriesId: 10, seasonNumber: -1 } },
  { catalog_scope: { kind: 'season', tmdbSeriesId: 10, seasonNumber: 1, approved: true } },
])('rejects invalid or flattened typed scope: %j', change => {
  expect(() => inventoryCatalogScopeKey({ ...season(), ...change })).toThrow('inventory_catalog_scope_invalid');
});
test('a parent query excludes all descriptions of its source grouping, including another mapped series', () => {
  const rows = [season(), season(20, 2), { ...season(30, 3), external_id: 'different' }];
  const held = inventoryDescriptionQueryExcludedHashes(rows, { key: 'tv:10', mediaType: 'tv', hash: 'query' });
  const hash = text => createHash('sha256').update(text).digest('hex');
  expect(held).toEqual(new Set(['query', hash(rows[0].overview), hash(rows[1].overview)]));
  expect(inventoryCatalogScopeMatches(rows[0], 'tv:10:season:1')).toBe(true);
  expect(inventoryCatalogScopeMatches(rows[0], 'movie:10')).toBe(false);
});
test('missing season text never borrows a parent synopsis supplied in metadata', () => {
  const row = { ...season(), overview: null, metadata: { overview: 'Parent synopsis' } };
  expect(prepareInventoryDescriptionCorpus([row], { includeSourceItems: true }).documents).toEqual([]);
});
