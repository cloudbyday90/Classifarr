/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { copyNeighborReferenceTargets, measureNeighborReferenceCoverage } from '../../services/neighborReferenceCoverage.mjs';
import { prepareMatchCalibrationCorpus } from '../../services/inventoryMatchCalibrationCorpus.mjs';
import { matchCalibrationFixture } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

function fixture() {
  const input = matchCalibrationFixture(), corpus = prepareMatchCalibrationCorpus(input), query = corpus.vectors.get(input.entry.descriptionHash);
  const candidates = [1, 2].map(id => {
    const items = input.documents.filter(doc => doc.libraryIds[0] === id && !input.entry.heldDescriptionHashes.has(doc.hash))
      .map(doc => ({ hash: doc.hash, similarity: query.reduce((sum, value, index) => sum + value * corpus.vectors.get(doc.hash)[index], 0) }))
      .sort((a, b) => b.similarity - a.similarity);
    return { id, eligible: items.length, items: items.slice(0, 3) };
  });
  return { input, corpus, query, candidates };
}

test('independent sorted-score oracle agrees with exact-hit recall and top-three score gap', () => {
  const { input, corpus, query, candidates } = fixture();
  const targets = copyNeighborReferenceTargets(candidates, corpus, 'movie', input.entry.heldDescriptionHashes);
  const references = input.documents.filter(doc => doc.libraryIds[0] === 1 && doc.id >= 3 && doc.id < 30)
    .map(doc => ({ hash: doc.hash, vector: corpus.vectors.get(doc.hash) }));
  let work = 0;
  const [result] = measureNeighborReferenceCoverage([{ libraryId: 1, references }], targets, query, value => { work += value; });
  const scores = references.map(row => row.vector.reduce((sum, value, index) => sum + value * query[index], 0)).sort((a, b) => b - a);
  const expectedGap = candidates[0].items.reduce((sum, row) => sum + row.similarity, 0) / 3 - scores.slice(0, 3).reduce((a, b) => a + b) / 3;
  expect(result).toMatchObject({ expected: 3, recovered: 2, selectionStatus: 'ordered' });
  expect(result.meanSimilarityGap).toBeCloseTo(expectedGap, 12); expect(work).toBe(2 * references.length);
  candidates[0].items[0].hash = 'mutation'; expect(targets[0].items[0].hash).not.toBe('mutation');
  const sparse = measureNeighborReferenceCoverage([{ libraryId: 1, references: references.slice(0, 2), selectionStatus: 'unchanged_small' }], targets, query);
  expect(sparse[0].meanSimilarityGap).toBeNull();
  targets[0].items.forEach(row => { row.similarity = -1; });
  expect(() => measureNeighborReferenceCoverage([{ libraryId: 1, references }], targets, query)).toThrow('inconsistent');
});

test.each(['missing', 'duplicate', 'id', 'count', 'length', 'repeated_hash', 'held', 'foreign', 'shared', 'nonfinite', 'range'])('rejects %s target diagnostics', kind => {
  const { input, corpus, candidates } = fixture();
  if (kind === 'missing') candidates.pop();
  if (kind === 'duplicate') candidates[1].id = 1;
  if (kind === 'id') candidates[1].id = 999;
  if (kind === 'count') candidates[0].eligible = -1;
  if (kind === 'length') candidates[0].items.pop();
  if (kind === 'repeated_hash') candidates[0].items[1].hash = candidates[0].items[0].hash;
  if (kind === 'held') candidates[0].items[0].hash = input.entry.descriptionHash;
  if (kind === 'foreign') candidates[0].items[0].hash = candidates[1].items[0].hash;
  if (kind === 'shared') corpus.groups.get(`movie:${candidates[0].items[0].hash}`).libraryIds.add(2);
  if (kind === 'nonfinite') candidates[0].items[0].similarity = NaN;
  if (kind === 'range') candidates[0].items[0].similarity = 2;
  expect(() => copyNeighborReferenceTargets(candidates, corpus, 'movie', input.entry.heldDescriptionHashes)).toThrow('targets_invalid');
});
