/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createInventoryNeighborCalibration } from '../../services/inventoryNeighborCalibration.mjs';
import { matchCalibrationFixture, calibrationHash } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

test('fits all same-media libraries with disjoint, held-out reference and calibration groups', async () => {
  const input = matchCalibrationFixture();
  const result = await createInventoryNeighborCalibration(input).assess(input.entry);
  expect(result.candidates).toMatchObject([{ libraryId: 1, referenceDescriptions: 39, calibrationDescriptions: 20 },
    { libraryId: 2, referenceDescriptions: 40, calibrationDescriptions: 20 }]);
  input.documents.push({ ...input.documents[2], id: 999, key: 'movie:999', libraryIds: [2] });
  input.documents.push({ ...input.documents[0], id: 998, key: 'movie:998' });
  const copies = await createInventoryNeighborCalibration(input).assess(input.entry);
  expect(copies.candidates.map(row => row.referenceDescriptions)).toEqual([38, 40]);
  expect(copies.snapshotId).not.toBe(result.snapshotId);
  expect(JSON.stringify(result)).not.toMatch(/Private|movie:|tmdb|confidence|vectors/);
});

test('names and order do not train the system, while changed vectors, representations and folds invalidate models', async () => {
  const input = matchCalibrationFixture(), expected = await createInventoryNeighborCalibration(input).assess(input.entry);
  const reordered = matchCalibrationFixture();
  reordered.documents.reverse(); reordered.libraries.reverse().forEach(lib => { lib.name = 'Different'; });
  reordered.vectors = new Map([...reordered.vectors].reverse());
  expect(await createInventoryNeighborCalibration(reordered).assess(reordered.entry)).toEqual(expected);
  for (const change of [value => value.vectors.set(value.documents[2].hash, [0, 1]),
    value => { value.representation.digest = 'b'.repeat(64); },
    value => { value.entry.heldDescriptionHashes.add(value.documents[2].hash); }]) {
    const changed = matchCalibrationFixture(); change(changed);
    expect((await createInventoryNeighborCalibration(changed).assess(changed.entry)).snapshotId).not.toBe(expected.snapshotId);
  }
});

test('sparse rivals remain in the comparison and a single-library pool cannot calibrate a margin', async () => {
  const input = matchCalibrationFixture(); input.documents = input.documents.filter(doc => doc.libraryIds[0] !== 1 || doc.id <= 30);
  const result = await createInventoryNeighborCalibration(input).assess(input.entry);
  expect(result.candidates.every(row => row.status === 'sparse' && !row.calibrated)).toBe(true);
  const tv = input.documents.find(doc => doc.type === 'tv');
  expect(await createInventoryNeighborCalibration(input).assess({ mediaType: 'tv', itemIdentity: { mediaType: 'tv', tmdbId: tv.id },
    descriptionHash: tv.hash, heldDescriptionHashes: new Set([tv.hash]) })).toMatchObject({ status: 'insufficient_libraries', candidates: [] });
});

test('copies snapshot, freezes query scope across await, and never exposes mutable model state', async () => {
  const input = matchCalibrationFixture(), session = createInventoryNeighborCalibration(input);
  const expected = await createInventoryNeighborCalibration(input).assess(input.entry);
  const original = { ...input.entry, itemIdentity: { ...input.entry.itemIdentity }, heldDescriptionHashes: new Set(input.entry.heldDescriptionHashes) };
  const pending = session.assess(input.entry);
  input.entry.descriptionHash = input.documents[80].hash; input.entry.heldDescriptionHashes.clear();
  input.vectors.clear(); input.documents.length = 0; input.libraries.length = 0;
  expect(await pending).toEqual(expected);
  const changed = await session.assess(original); changed.candidates[0].status = 'forged';
  expect(await session.assess(original)).toEqual(expected);
});

test('cancelled fits are evicted, retry and concurrent requests share a complete result', async () => {
  const input = matchCalibrationFixture(), session = createInventoryNeighborCalibration(input), abort = new AbortController();
  const pending = session.assess(input.entry, { signal: abort.signal }); abort.abort();
  await expect(pending).rejects.toThrow();
  const [first, second] = await Promise.all([session.assess(input.entry), session.assess(input.entry)]);
  expect(first).toEqual(second);
  await expect(session.assess(input.entry, { signal: abort.signal })).rejects.toThrow();
});

test.each([
  entry => { entry.heldDescriptionHashes = new Set(); },
  entry => { entry.itemIdentity.tmdbId = 2; },
  entry => { entry.itemIdentity.mediaType = 'tv'; },
  entry => { entry.heldDescriptionHashes.add(calibrationHash('missing')); },
])('rejects leaked query scope even after a cached fit', async change => {
  const input = matchCalibrationFixture(), session = createInventoryNeighborCalibration(input);
  await session.assess(input.entry); change(input.entry);
  await expect(session.assess(input.entry)).rejects.toThrow();
});

test('bounds model count and rejects malformed snapshots', async () => {
  const input = matchCalibrationFixture(); input.documents = input.documents.slice(0, 30);
  const session = createInventoryNeighborCalibration(input);
  for (let index = 1; index <= 20; index++) {
    await session.assess({ ...input.entry, heldDescriptionHashes: new Set([input.entry.descriptionHash, input.documents[index].hash]) });
  }
  await expect(session.assess(input.entry)).rejects.toThrow('fold_budget');
  input.vectors.set(input.entry.descriptionHash, [0, 0]);
  expect(() => createInventoryNeighborCalibration(input)).toThrow();
});
