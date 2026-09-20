/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { prepareLeaderChallengeEvidence } from '../../services/inventoryLeaderChallengeEvidence.mjs';

const representation = { provider: 'ollama', model: 'embedding:latest', digest: 'b'.repeat(64), dimensions: 2 };
const settings = { ...freshSettings, generateCases: 0 };

test('both calibration families use exactly the clean training groups, while evaluating excluded query identities', async () => {
  const { source } = freshFixture(360);
  source.trainingExclusions = new Set(source.corpus.documents.filter(doc => doc.libraryIds[0] === 1).map(doc => doc.key));
  const prepared = await prepareLeaderChallengeEvidence(source, representation, settings);
  const doc = source.corpus.documents.find(value => prepared.sample.includes(value) && value.type === 'movie');
  const entry = await prepared.forDocument(doc);
  const first = await prepared.calibrate(entry);
  expect(first.match.candidates.find(candidate => candidate.libraryId === 1)).toMatchObject({ eligibleDescriptions: 0, status: 'sparse' });
  expect(first.neighbor.candidates.every(candidate => candidate.status === 'sparse')).toBe(true);
  for (const candidate of first.match.candidates.filter(value => value.libraryId !== 1)) {
    const admitted = source.corpus.documents.filter(value => value.libraryIds.includes(candidate.libraryId) && !entry.heldDescriptionHashes.has(value.hash));
    expect(candidate.eligibleDescriptions).toBe(admitted.length);
    expect(candidate.referenceDescriptions + candidate.calibrationDescriptions).toBe(admitted.length);
  }
  expect(await prepared.calibrate(entry)).toEqual(first);
  await expect(prepared.calibrate({ ...entry, foldIndex: 999 })).rejects.toThrow('fold_invalid');
  await expect(prepared.calibrate({ ...entry, heldDescriptionHashes: null })).rejects.toThrow('fold_invalid');
  await expect(prepared.calibrate({ ...entry, descriptionHash: 'x' })).rejects.toThrow('fold_invalid');
  await expect(prepared.calibrate({ ...entry, heldDescriptionHashes: new Set([...entry.heldDescriptionHashes, 'x']) })).rejects.toThrow('fold_invalid');
  await expect(prepared.calibrate({ ...entry, itemIdentity: { ...entry.itemIdentity, mediaType: 'tv' } })).rejects.toThrow('query_invalid');
  await expect(prepared.calibrate(entry, { signal: AbortSignal.abort() })).rejects.toThrow();
});

test('whole held folds and all retained-history description copies are excluded for both media', async () => {
  const { source } = freshFixture(360);
  source.trainingExclusions = new Set();
  const excludedHashes = new Set();
  for (const [index, type] of ['movie', 'tv'].entries()) {
    const original = source.corpus.documents.find(doc => doc.type === type);
    const copy = { ...original, id: 10001 + index, key: `${type}:${10001 + index}` };
    source.corpus.documents.push(copy);
    source.candidateMetadata.set(copy.key, structuredClone(source.candidateMetadata.get(original.key)));
    source.trainingExclusions.add(copy.key); excludedHashes.add(copy.hash);
  }
  const prepared = await prepareLeaderChallengeEvidence(source, representation, settings);
  for (const type of ['movie', 'tv']) {
    const entry = await prepared.forDocument(prepared.sample.find(doc => doc.type === type));
    const result = await prepared.calibrate(entry);
    expect(result.neighbor.candidates.every(candidate => candidate.status === 'available')).toBe(true);
    for (const candidate of result.match.candidates) {
      const expected = source.corpus.documents.filter(doc => doc.libraryIds.includes(candidate.libraryId) &&
        !entry.heldDescriptionHashes.has(doc.hash) && !excludedHashes.has(doc.hash)).length;
      expect(candidate.eligibleDescriptions).toBe(expected);
    }
  }
});
