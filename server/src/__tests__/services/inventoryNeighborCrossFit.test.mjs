/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createInventoryNeighborCalibration } from '../../services/inventoryNeighborCalibration.mjs';
import { prepareMatchCalibrationCorpus, splitMatchCalibrationGroups } from '../../services/inventoryMatchCalibrationCorpus.mjs';
import { selectNeighborCrossFitGroups } from '../../services/libraryNeighborCrossFit.mjs';
import { matchCalibrationFixture } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

const session = input => createInventoryNeighborCalibration(input, { crossFit: true });

test('small libraries gain calibration without borrowing movie/TV, held-out or shared copies', async () => {
  const input = matchCalibrationFixture();
  input.documents = input.documents.filter(doc => doc.id % 60 <= 29 && doc.id % 60 > 0);
  input.documents.push({ ...input.documents[2], id: 999, key: 'movie:999', libraryIds: [2] });
  input.documents.push({ ...input.documents[0], id: 998, key: 'movie:998' });
  const corpus = prepareMatchCalibrationCorpus(input);
  const groups = selectNeighborCrossFitGroups(splitMatchCalibrationGroups(corpus, 'movie', input.entry.heldDescriptionHashes), corpus.vectors);
  expect(groups.map(group => group.libraryId)).toEqual([1, 2]);
  expect(groups.map(group => group.references.length)).toEqual([27, 29]);
  const trainingHashes = groups.flatMap(group => group.references.map(item => item.hash));
  expect(trainingHashes).not.toContain(input.documents[0].hash);
  expect(trainingHashes).not.toContain(input.documents[2].hash);
  expect((await createInventoryNeighborCalibration(input).assess(input.entry)).candidates.every(row => row.status === 'sparse')).toBe(true);
  const result = await session(input).assess(input.entry);
  expect(result).toMatchObject({ version: 'library_neighbor_cross_fit_v1', status: 'evaluated' });
  expect(result.candidates.every(row => row.status === 'available' && row.minimumCalibrationReferences >= 20)).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/Private|hash|vector|tmdb|confidence/);
});

test('mode, fold, representation and membership are snapshot-bound; names and order do not train', async () => {
  const input = matchCalibrationFixture(), expected = await session(input).assess(input.entry);
  expect(expected.snapshotId).not.toBe((await createInventoryNeighborCalibration(input).assess(input.entry)).snapshotId);
  const reordered = matchCalibrationFixture(); reordered.documents.reverse(); reordered.libraries.reverse().forEach(lib => { lib.name = 'Renamed'; });
  expect(await session(reordered).assess(reordered.entry)).toEqual(expected);
  for (const change of [value => { value.entry.heldDescriptionHashes.add(value.documents[2].hash); },
    value => { value.representation.digest = 'b'.repeat(64); }, value => { value.documents[2].libraryIds = [2]; }]) {
    const changed = matchCalibrationFixture(); change(changed);
    expect((await session(changed).assess(changed.entry)).snapshotId).not.toBe(expected.snapshotId);
  }
  expect(() => createInventoryNeighborCalibration(input, { crossFit: 'true' })).toThrow('mode_invalid');
});

test('query and corpus mutations cannot change an in-progress fit or bypass cached held-out validation', async () => {
  const input = matchCalibrationFixture(), model = session(input), expected = await session(input).assess(input.entry);
  const original = { ...input.entry, itemIdentity: { ...input.entry.itemIdentity }, heldDescriptionHashes: new Set(input.entry.heldDescriptionHashes) };
  const pending = model.assess(input.entry);
  input.entry.descriptionHash = input.documents[80].hash; input.entry.heldDescriptionHashes.clear(); input.vectors.clear();
  expect(await pending).toEqual(expected);
  expect(await model.assess(original)).toEqual(expected);
  await expect(model.assess(input.entry)).rejects.toThrow('query_invalid');
});

test('interrupted cross-fits are evicted and concurrent retries share the completed fit', async () => {
  const input = matchCalibrationFixture(), model = session(input), abort = new AbortController();
  const pending = model.assess(input.entry, { signal: abort.signal }); abort.abort();
  await expect(pending).rejects.toThrow();
  const [first, second] = await Promise.all([model.assess(input.entry), model.assess(input.entry)]);
  expect(first).toEqual(second);
});
