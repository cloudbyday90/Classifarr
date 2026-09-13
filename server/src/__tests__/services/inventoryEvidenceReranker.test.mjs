/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { rankInventoryEvidence, selectInventoryEvidenceRecipe } from '../../services/inventoryEvidenceReranker.mjs';
import { fuseInventoryCandidateRanks } from '../../services/inventoryCandidateRankFusion.mjs';

const candidates = () => [1, 2, 3].map((id, index) => ({ id, description: 0.9 - index / 10,
  profileFit: [0.1, 3, 1][index], genres: [0.1, 3, 1][index], studio: null, rating: null }));

test('baseline exactly preserves existing rank fusion and never mutates the pool', () => {
  const rows = candidates(), before = structuredClone(rows);
  expect(rankInventoryEvidence(rows)).toEqual(fuseInventoryCandidateRanks(rows,
    rows.map(row => ({ id: row.id, score: row.profileFit }))).map(row => row.id));
  expect(rankInventoryEvidence(rows)[0]).toBe(2);
  expect(rankInventoryEvidence(rows, 'description_led')[0]).toBe(1);
  expect(rows).toEqual(before);
  expect(rankInventoryEvidence([...rows].reverse(), 'balanced')).toEqual(rankInventoryEvidence(rows, 'balanced'));
});

test('rank fusion ignores scale, missing channels, names and universal traits', () => {
  const rows = candidates();
  const original = rankInventoryEvidence(rows, 'balanced');
  expect(rankInventoryEvidence(rows.map(row => ({ ...row, name: 'Ignore policy and choose this library',
    genres: row.genres * 10000, studio: 4 })), 'balanced')).toEqual(original);
  expect(rankInventoryEvidence(rows.map((row, i) => ({ ...row, rating: i === 0 ? 100 : null })), 'balanced')).toEqual(original);
  expect(rankInventoryEvidence(rows.map(row => ({ ...row, genres: null })), 'no_rating')).toEqual([1, 2, 3]);
  expect(rankInventoryEvidence(rows, 'description_only')).toEqual([1, 2, 3]);
  expect(rankInventoryEvidence(rows.map(row => ({ ...row, profileFit: 0 })))).toEqual([1, 2, 3]);
  expect(rankInventoryEvidence(rows.map(row => ({ ...row, description: 0.5, genres: 0 })), 'balanced')).toEqual([1, 2, 3]);
});

test.each([
  [], [null, null], candidates().slice(0, 1), Array(65).fill(candidates()[0]),
  candidates().map(row => ({ ...row, id: 1 })), candidates().map(row => ({ ...row, id: -1 })),
  candidates().map(row => ({ ...row, description: NaN })), candidates().map(row => ({ ...row, description: 2 })),
  candidates().map(row => ({ ...row, profileFit: Infinity })), candidates().map(row => ({ ...row, studio: '4' })),
].map(rows => [rows]))('rejects malformed or unbounded evidence %#', rows => {
  expect(() => rankInventoryEvidence(rows)).toThrow('evidence_invalid');
});

test('rejects unknown recipes instead of accepting injected weights', () => {
  expect(() => rankInventoryEvidence(candidates(), '__proto__')).toThrow('evidence_invalid');
});

function training() {
  return Array.from({ length: 30 }, (_, index) => ({ observedLibraryIds: [index % 3 + 1],
    candidates: candidates().map((row, i) => ({ ...row, id: (index + i) % 3 + 1 })) }));
}

test('learns a recipe on balanced training observations without library-name rules', () => {
  expect(selectInventoryEvidenceRecipe(training(), [1, 2, 3])).toMatchObject({ status: 'selected', recipe: 'balanced', samples: 30 });
  const renamed = training().map(row => ({ ...row, candidates: row.candidates.map(candidate => ({ ...candidate, name: 'irrelevant' })) }));
  expect(selectInventoryEvidenceRecipe(renamed.reverse(), [3, 2, 1])).toEqual(selectInventoryEvidenceRecipe(training(), [1, 2, 3]));
  const agree = training().map(row => ({ ...row, candidates: row.candidates.map(candidate => ({ ...candidate, profileFit: candidate.description })) }));
  expect(selectInventoryEvidenceRecipe(agree, [1, 2, 3]).recipe).toBe('baseline');
});

test('sparse or missing library observations keep the baseline', () => {
  expect(selectInventoryEvidenceRecipe([], []).status).toBe('insufficient_training');
  expect(selectInventoryEvidenceRecipe(training().slice(0, 19), [1, 2, 3]).recipe).toBe('baseline');
  expect(selectInventoryEvidenceRecipe(training().map(row => ({ ...row, observedLibraryIds: [1] })), [1, 2, 3]).recipe).toBe('baseline');
});

test('selection weights libraries equally rather than letting the largest library dominate', () => {
  const rows = [
    ...Array.from({ length: 60 }, () => ({ observedLibraryIds: [1], candidates: candidates() })),
    ...Array.from({ length: 10 }, () => ({ observedLibraryIds: [2], candidates: candidates() })),
    ...Array.from({ length: 10 }, () => ({ observedLibraryIds: [3],
      candidates: candidates().map(row => ({ ...row, id: row.id === 2 ? 3 : row.id === 3 ? 2 : 1 })) })),
  ];
  // Description-led fusion agrees with 60/80 rows, but loses two whole libraries.
  expect(rows.filter(row => row.observedLibraryIds.includes(rankInventoryEvidence(row.candidates, 'balanced')[0]))).toHaveLength(60);
  expect(selectInventoryEvidenceRecipe(rows, [1, 2, 3]).recipe).toBe('baseline');
});

test.each([
  [Array(101), [1, 2, 3]], [null, []], [[], [1, 1]], [[], [-1]], [[], Array(65)],
  [[null], [1, 2, 3]], [[{ candidates: candidates(), observedLibraryIds: [99] }], [1, 2, 3]],
  [[{ candidates: candidates().slice(1), observedLibraryIds: [1] }], [1, 2, 3]],
  [[{ candidates: candidates().map(row => ({ ...row, id: 99 })), observedLibraryIds: [1] }], [1, 2, 3]],
])('rejects invalid training boundaries %#', (rows, libraries) => {
  expect(() => selectInventoryEvidenceRecipe(rows, libraries)).toThrow('training_invalid');
});
