/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { buildNeighborReferenceReport } from '../../services/inventoryNeighborReferenceReport.mjs';

test('aggregates paired candidate coverage, improvement and regression without leaking source identities', () => {
  const libraries = [{ id: 999, media_type: 'movie', name: 'Private' }, { id: 1000, media_type: 'tv', name: 'Private' }];
  const value = (libraryId, recovered, gap, selectionStatus) => ({ libraryId, expected: 3, recovered, meanSimilarityGap: gap, selectionStatus, hash: 'secret' });
  const rows = [
    { mediaType: 'movie', ordered: [value(999, 1, .2, 'ordered')], representative: [value(999, 3, 0, 'representative')] },
    { mediaType: 'movie', ordered: [value(999, 3, 0, 'ordered')], representative: [value(999, 2, .1, 'representative')] },
    { mediaType: 'tv', ordered: [value(1000, 1, .1, 'ordered')], representative: [value(1000, 1, .1, 'ordered_fallback')] },
  ];
  const report = buildNeighborReferenceReport(rows, libraries);
  expect(report).toMatchObject({ nominatedQueries: 3, candidateComparisons: 3, improvedMean: 1, worsenedMean: 1, unchangedMean: 1,
    ordered: { expected: 9, recovered: 5, recall: .555556, meanSimilarityGap: .1 },
    representative: { recovered: 6, recall: .666667, fullTopThree: 1, meanSimilarityGap: .066667 } });
  expect(report.byMedia.map(row => row.candidateComparisons)).toEqual([2, 1]);
  expect(report.byLibrary.map(row => row.stratum)).toEqual([1, 2]);
  expect(JSON.stringify(report)).not.toMatch(/Private|999|1000|libraryId|hash|secret/);
  rows[0].representative = [];
  expect(() => buildNeighborReferenceReport(rows, libraries)).toThrow('scope_mismatch');
});

test('empty and incomplete coverage remains unknown rather than perfect recall', () => {
  expect(buildNeighborReferenceReport([], []).ordered).toMatchObject({ recall: null, meanSimilarityGap: null, selectionStatuses: {} });
  const arm = [{ libraryId: 1, expected: 0, recovered: 0, meanSimilarityGap: null, selectionStatus: 'unchanged_small' }];
  expect(buildNeighborReferenceReport([{ mediaType: 'movie', ordered: arm, representative: arm }], []).unchangedMean).toBe(0);
});
