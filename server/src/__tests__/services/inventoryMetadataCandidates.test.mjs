/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { collectInventoryCandidateMetadata, rankInventoryMetadataCandidates } from '../../services/inventoryMetadataCandidates.mjs';
import { buildInventoryDescriptionCorpusSql, INVENTORY_DESCRIPTION_CORPUS_SQL } from '../../services/inventoryDescriptionCorpus.mjs';

test('metadata projection is limited to explicitly opted-in snapshot queries', () => {
  expect(INVENTORY_DESCRIPTION_CORPUS_SQL).not.toContain('msi.genres');
  expect(buildInventoryDescriptionCorpusSql({ includeCandidateMetadata: true })).toContain('msi.genres, msi.studio, msi.content_rating');
});

test('normalizes bounded observations and rejects conflicting identity metadata', () => {
  const row = { media_type: 'movie', tmdb_id: 1, genres: [' Animation ', 'Animation', null], studio: 'Studio', content_rating: 'PG' };
  const values = collectInventoryCandidateMetadata([row]);
  expect(values.get('movie:1')).toEqual({ genres: ['animation'], studio: 'studio', rating: 'pg' });
  expect(collectInventoryCandidateMetadata([row, { ...row, studio: 'Other' }, row]).get('movie:1')).toBeNull();
  expect(collectInventoryCandidateMetadata([{ ...row, genres: {}, studio: 'x'.repeat(161) }]).get('movie:1').studio).toBe('');
});

const ranked = [1, 2, 3, 4].map(id => ({ id }));
const query = { genres: ['animation'], studio: 'studio', rating: 'pg' };
const example = (id, metadata = query) => ({ hash: String(id), libraryIds: [id], metadata });

test('complementary metadata admits an omitted candidate without observing query placement', () => {
  const result = rankInventoryMetadataCandidates(ranked, query, [example(4), example(1, { ...query, studio: '', genres: ['drama'] })]);
  expect(result.slice(0, 3).map(entry => entry.id)).toContain(4);
  expect(ranked.map(entry => entry.id)).toEqual([1, 2, 3, 4]);
});

test('missing evidence and ratings alone preserve description ranking', () => {
  expect(rankInventoryMetadataCandidates(ranked, null, [])).toBe(ranked);
  expect(rankInventoryMetadataCandidates(ranked, query, [example(4, { genres: [], studio: '', rating: 'pg' })])).toBe(ranked);
});

test('equal metadata and repeated descriptions cannot invent an extra preference', () => {
  expect(rankInventoryMetadataCandidates(ranked, query, ranked.map(entry => example(entry.id)))).toEqual(ranked);
  const once = rankInventoryMetadataCandidates(ranked, query, [example(4), example(1)]);
  expect(rankInventoryMetadataCandidates(ranked, query, [example(4), example(4), example(4), example(1)])).toEqual(once);
  const conflict = { ...example(4), metadata: { ...query, studio: 'other' } };
  expect(rankInventoryMetadataCandidates(ranked, query, [example(4), conflict])).toBe(ranked);
  expect(rankInventoryMetadataCandidates(ranked, query, [conflict, example(4)])).toBe(ranked);
});
