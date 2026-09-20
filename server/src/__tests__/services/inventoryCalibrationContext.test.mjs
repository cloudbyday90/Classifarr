/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { resolveInventoryCalibrationContext } from '../../services/inventoryCalibrationContext.mjs';
import { prepareMatchCalibrationCorpus } from '../../services/inventoryMatchCalibrationCorpus.mjs';
import { createPairedInventoryNeighborCalibration } from '../../services/inventoryNeighborCalibration.mjs';
import { createInventoryMatchCalibration } from '../../services/inventoryMatchCalibration.mjs';
import { matchCalibrationFixture } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

test('binds query identity, whole scope, vectors and representation while ignoring library display names', () => {
  const input = matchCalibrationFixture();
  const context = value => resolveInventoryCalibrationContext(prepareMatchCalibrationCorpus(value), value.entry).contextId;
  const expected = context(input);
  for (const change of [value => { value.entry.heldDescriptionHashes.add(value.documents[2].hash); },
    value => { value.representation.digest = 'b'.repeat(64); }, value => value.vectors.set(value.documents[4].hash, [0, 1]),
    value => { value.documents[4].libraryIds = [2]; }, value => { value.entry.itemIdentity.tmdbId = 2;
      value.entry.descriptionHash = value.documents[1].hash; value.entry.heldDescriptionHashes.add(value.documents[1].hash); }]) {
    const changed = matchCalibrationFixture(); change(changed); expect(context(changed)).not.toBe(expected);
  }
  input.libraries.reverse().forEach(lib => { lib.name = 'anything'; }); input.documents.reverse();
  expect(context(input)).toBe(expected);
  const corpus = prepareMatchCalibrationCorpus(input), bound = resolveInventoryCalibrationContext(corpus, input.entry);
  input.entry.heldDescriptionHashes.clear(); expect(bound.exclusions.size).toBe(1);
});

test.each([null, {}, { itemIdentity: null }, { itemIdentity: { mediaType: 'movie', tmdbId: '1' } },
  { itemIdentity: { mediaType: 'tv', tmdbId: 1 } }, { itemIdentity: { mediaType: 'movie', tmdbId: 0 } },
  { descriptionHash: 'bad' }, { heldDescriptionHashes: new Set() }])('rejects invalid context %j', patch => {
  const input = matchCalibrationFixture(), corpus = prepareMatchCalibrationCorpus(input);
  expect(() => resolveInventoryCalibrationContext(corpus, patch && Object.keys(patch).length ? { ...input.entry, ...patch } : patch)).toThrow('query_invalid');
});

test('omission is strictly typed, same-media scoped, changes context, and both calibration families agree', async () => {
  const input = matchCalibrationFixture(), corpus = prepareMatchCalibrationCorpus(input);
  for (const id of [0, 3, 999, '1', NaN]) expect(() => resolveInventoryCalibrationContext(corpus, input.entry, id)).toThrow('scope_invalid');
  const exact = createPairedInventoryNeighborCalibration(input, { exact: true }).exact;
  const contextId = exact.contextFor(input.entry), match = createInventoryMatchCalibration(input, { crossFit: true });
  expect((await match.assess(input.entry)).contextId).toBe(contextId);
  expect((await exact.assess(input.entry)).contextId).toBe(contextId);
  const omitted = exact.contextFor(input.entry, 1);
  expect(omitted).not.toBe(contextId);
  expect(await exact.assess(input.entry, { omittedLibraryId: 1 })).toMatchObject({ contextId: omitted, status: 'insufficient_libraries' });
  expect(await match.assess(input.entry, { omittedLibraryId: 1 })).toMatchObject({ contextId: omitted, candidates: [{ libraryId: 2 }] });
});

test.each([[NaN, 1], [0, 0], [1], ['1', 0], [Infinity, 0]].map(vector => [vector]))('corrupted embedding %j cannot enter the context-bound corpus', vector => {
  const input = matchCalibrationFixture(); input.vectors.set(input.entry.descriptionHash, vector);
  expect(() => prepareMatchCalibrationCorpus(input)).toThrow();
});
