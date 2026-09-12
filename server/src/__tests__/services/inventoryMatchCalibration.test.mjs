/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createInventoryMatchCalibration } from '../../services/inventoryMatchCalibration.mjs';
import { prepareMatchCalibrationCorpus, splitMatchCalibrationGroups } from '../../services/inventoryMatchCalibrationCorpus.mjs';
import { matchCalibrationFixture, calibrationHash } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

test('fits only same-media libraries, keeps query/copy groups out of both split halves', async () => {
  const input = matchCalibrationFixture();
  const corpus = prepareMatchCalibrationCorpus(input);
  const splits = splitMatchCalibrationGroups(corpus, 'movie', input.entry.heldDescriptionHashes);
  expect(splits.map(row => row.libraryId)).toEqual([1, 2]);
  expect(splits[0]).toMatchObject({ eligibleDescriptions: 59, sharedDescriptionsExcluded: 0 });
  for (const split of splits) {
    expect(split.calibration).toHaveLength(20);
    expect(split.references.length).toBeGreaterThanOrEqual(20);
    expect(split.references.some(hash => split.calibration.includes(hash))).toBe(false);
    expect([...split.references, ...split.calibration]).not.toContain(input.entry.descriptionHash);
  }
  const result = await createInventoryMatchCalibration(input).assess(input.entry);
  expect(result.candidates[1]).toMatchObject({ libraryId: 2, status: 'unusual', empiricalRank: 1 / 21 });
  expect(JSON.stringify(result)).not.toMatch(/Private|movie:|tmdb|accuracy|confidence/);
});

test('duplicate synopses collapse; cross-library copies do not train either library', () => {
  const input = matchCalibrationFixture();
  const duplicate = { ...input.documents[2], id: 999, key: 'movie:999', libraryIds: [2] };
  input.documents.push(duplicate);
  input.documents.push({ ...input.documents[0], id: 998, key: 'movie:998' });
  const splits = splitMatchCalibrationGroups(prepareMatchCalibrationCorpus(input), 'movie', input.entry.heldDescriptionHashes);
  expect(splits[0]).toMatchObject({ eligibleDescriptions: 58, sharedDescriptionsExcluded: 1 });
  expect(splits[1]).toMatchObject({ eligibleDescriptions: 60, sharedDescriptionsExcluded: 1 });
  expect(splits.every(row => ![...row.references, ...row.calibration].includes(duplicate.hash))).toBe(true);
});

test('sparse libraries do not borrow support from other libraries', async () => {
  const input = matchCalibrationFixture();
  input.documents = input.documents.filter(doc => doc.libraryIds[0] !== 1 || doc.id <= 30);
  const result = await createInventoryMatchCalibration(input).assess(input.entry);
  expect(result.candidates[0]).toMatchObject({ status: 'sparse', eligibleDescriptions: 29, calibrationDescriptions: 0 });
  expect(result.candidates[1].calibrationDescriptions).toBe(20);
});

test('order and names are irrelevant; changed vectors, memberships, representation or folds change the snapshot', async () => {
  const input = matchCalibrationFixture(), expected = await createInventoryMatchCalibration(input).assess(input.entry);
  const reordered = matchCalibrationFixture();
  reordered.documents.reverse(); reordered.libraries.reverse().forEach(lib => { lib.name = 'Renamed'; });
  reordered.vectors = new Map([...reordered.vectors].reverse());
  expect(await createInventoryMatchCalibration(reordered).assess(reordered.entry)).toEqual(expected);
  for (const change of [value => value.vectors.set(value.documents[2].hash, [0, 1]),
    value => { value.documents[2].libraryIds = [2]; }, value => { value.representation.digest = 'b'.repeat(64); },
    value => { value.entry.heldDescriptionHashes.add(value.documents[2].hash); },
    value => { value.libraries.push({ id: 4, media_type: 'movie' }); }]) {
    const changed = matchCalibrationFixture(); change(changed);
    expect((await createInventoryMatchCalibration(changed).assess(changed.entry)).snapshotId).not.toBe(expected.snapshotId);
  }
});

test('copies its source, reuses fitted models, and does not leak model arrays through results', async () => {
  const input = matchCalibrationFixture(), session = createInventoryMatchCalibration(input);
  const first = await session.assess(input.entry);
  const expected = structuredClone(first);
  first.candidates[0].status = 'forged';
  input.vectors.clear(); input.documents.length = 0; input.libraries.length = 0;
  expect(await session.assess(input.entry)).toEqual(expected);
  expect(JSON.stringify(session)).toBe('{}');
});

test('failed/cancelled fits are not cached as usable evidence and concurrent callers share a fit', async () => {
  const input = matchCalibrationFixture(), session = createInventoryMatchCalibration(input), abort = new AbortController();
  const pending = session.assess(input.entry, { signal: abort.signal }); abort.abort();
  await expect(pending).rejects.toThrow();
  const [a, b] = await Promise.all([session.assess(input.entry), session.assess(input.entry)]);
  expect(a).toEqual(b);
  const early = new AbortController(); early.abort();
  await expect(session.assess(input.entry, { signal: early.signal })).rejects.toThrow();
});

test('query mutation while fitting cannot replace the frozen held-out query with a training item', async () => {
  const input = matchCalibrationFixture(), session = createInventoryMatchCalibration(input);
  const expected = await createInventoryMatchCalibration(input).assess(input.entry);
  const pending = session.assess(input.entry);
  input.entry.descriptionHash = input.documents[80].hash;
  input.entry.heldDescriptionHashes.clear();
  expect(await pending).toEqual(expected);
});

test('TV baselines do not train on movies even when their descriptions share a hash', async () => {
  const input = matchCalibrationFixture();
  input.documents[120].hash = input.documents[0].hash;
  const entry = { mediaType: 'tv', itemIdentity: { mediaType: 'tv', tmdbId: 121 },
    descriptionHash: input.documents[0].hash, heldDescriptionHashes: new Set([input.documents[0].hash]) };
  const result = await createInventoryMatchCalibration(input).assess(entry);
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]).toMatchObject({ libraryId: 3, eligibleDescriptions: 59, sharedDescriptionsExcluded: 0 });
});

test.each([
  value => { value.entry.heldDescriptionHashes = new Set(); },
  value => { value.entry.itemIdentity.tmdbId = 2; },
  value => { value.entry.itemIdentity.mediaType = 'tv'; },
  value => { value.entry.heldDescriptionHashes.add(calibrationHash('missing')); },
  value => { value.entry.heldDescriptionHashes.add('invalid'); },
])('rejects leaked or inconsistent held-out query scope', async change => {
  const input = matchCalibrationFixture(), session = createInventoryMatchCalibration(input); change(input);
  await expect(session.assess(input.entry)).rejects.toThrow();
});

test.each([
  value => { value.documents.push(value.documents[0]); },
  value => { value.documents[0].key = 'tv:1'; },
  value => { value.documents[0].libraryIds = [999]; },
  value => { value.documents[0].libraryIds = [1, 1]; },
  value => { value.documents[0].hash = 'invalid'; },
  value => { value.libraries[0].media_type = 'unknown'; },
  value => { value.libraries.push(value.libraries[0]); },
  value => { value.vectors.delete(value.documents[0].hash); },
  value => { value.vectors.set(value.documents[0].hash, [0, 0]); },
  value => { value.representation.dimensions = 3; },
  value => { value.representation.digest = 'invalid'; },
  value => { value.documents = Array(50001).fill(value.documents[0]); },
  value => { value.libraries = Array(65).fill(value.libraries[0]); },
  value => { value.vectors = null; },
])('rejects malformed snapshots before fitting', change => {
  const input = matchCalibrationFixture(); change(input);
  expect(() => createInventoryMatchCalibration(input)).toThrow();
});

test('bounds cache growth rather than retaining unlimited fold models', async () => {
  const input = matchCalibrationFixture();
  // Sparse models exercise the cache limit without unnecessary numeric work.
  input.documents = input.documents.slice(0, 30);
  const session = createInventoryMatchCalibration(input);
  for (let index = 1; index <= 20; index++) {
    await session.assess({ ...input.entry, heldDescriptionHashes: new Set([input.entry.descriptionHash, input.documents[index].hash]) });
  }
  await expect(session.assess(input.entry)).rejects.toThrow('fold_budget');
});
