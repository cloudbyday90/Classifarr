/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createPairedInventoryNeighborCalibration } from '../../services/inventoryNeighborCalibration.mjs';
import { prepareMatchCalibrationCorpus, splitMatchCalibrationGroups } from '../../services/inventoryMatchCalibrationCorpus.mjs';
import { matchCalibrationFixture, calibrationHash } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

const session = input => createPairedInventoryNeighborCalibration(input, { exact: true }).exact;
const resultOnly = ({ resources: _resources, ...result }) => result;

function oracle(input, entry) {
  const corpus = prepareMatchCalibrationCorpus(input);
  const splits = splitMatchCalibrationGroups(corpus, entry.mediaType, entry.heldDescriptionHashes);
  const groups = splits.map(split => ({ libraryId: split.libraryId,
    calibration: [...split.calibration, ...split.references].slice(0, 32),
    references: [...corpus.groups.values()].filter(group => group.mediaType === entry.mediaType &&
      group.libraryIds.size === 1 && group.libraryIds.has(split.libraryId) && !entry.heldDescriptionHashes.has(group.hash)).map(group => group.hash) }));
  const means = hash => groups.map(group => group.references.filter(ref => ref !== hash).map(ref =>
    corpus.vectors.get(ref).reduce((sum, value, axis) => sum + value * corpus.vectors.get(hash)[axis], 0))
    .map(value => Math.max(-1, Math.min(1, value))).sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0) / 3);
  const margin = (scores, target) => scores[target] - Math.max(...scores.filter((_, index) => index !== target));
  const query = means(entry.descriptionHash);
  return groups.map((group, target) => {
    const distributions = groups.map(source => source.calibration.map(hash => margin(means(hash), target)).sort((a, b) => a - b));
    const positive = distributions[target], threshold = Math.max(0, ...distributions.filter((_, index) => index !== target)
      .map(values => values[Math.ceil((values.length + 1) * .95) - 1]));
    const value = margin(query, target), rank = (1 + positive.filter(score => score <= value).length) / (1 + positive.length);
    const degenerate = positive[Math.ceil((positive.length - 1) * .9)] - positive[Math.floor((positive.length - 1) * .1)] <= 1e-6;
    return { libraryId: group.libraryId, referenceDescriptions: group.references.length, minimumCalibrationReferences: group.references.length - 1,
      calibrationDescriptions: group.calibration.length, status: degenerate ? 'degenerate' : 'available', calibrated: !degenerate && value > threshold && rank > .05 };
  });
}

test('all eligible references, including beyond the old 384-group split, match an independent brute-force calibration oracle', async () => {
  const input = matchCalibrationFixture();
  for (let id = 1000; id < 1800; id++) {
    const hash = calibrationHash(id), libraryId = id % 2 + 1;
    input.documents.push({ id, key: `movie:${id}`, type: 'movie', hash, libraryIds: [libraryId] });
    input.vectors.set(hash, [Math.cos(id), Math.sin(id)]);
  }
  const evaluator = session(input), first = await evaluator.assess(input.entry);
  expect(first.candidates).toMatchObject(oracle(input, input.entry));
  expect(first.candidates.map(candidate => candidate.referenceDescriptions)).toEqual([459, 460]);
  const held = { ...input.entry, heldDescriptionHashes: new Set([input.entry.descriptionHash, input.documents[2].hash]) };
  const cached = await evaluator.assess(held), fresh = await session(input).assess(held);
  expect(resultOnly(cached)).toEqual(resultOnly(fresh));
  expect(cached.candidates).toMatchObject(oracle(input, held));
  expect(cached.resources.computedComponents - first.resources.computedComponents).toBeLessThan(fresh.resources.computedComponents);
});

test('copies private snapshot, freezes held groups before awaiting and ignores library names and order', async () => {
  const input = matchCalibrationFixture(), evaluator = session(input);
  const expected = await session(input).assess(input.entry), entry = { ...input.entry, heldDescriptionHashes: new Set(input.entry.heldDescriptionHashes) };
  const pending = evaluator.assess(input.entry);
  input.entry.heldDescriptionHashes.clear(); input.entry.descriptionHash = 'changed'; input.vectors.clear(); input.documents.length = 0;
  expect(resultOnly(await pending)).toEqual(resultOnly(expected));
  const reordered = matchCalibrationFixture(); reordered.documents.reverse(); reordered.libraries.reverse().forEach(lib => { lib.name = 'Renamed'; });
  expect(resultOnly(await session(reordered).assess(entry))).toEqual(resultOnly(expected));
  const result = await evaluator.assess(entry); result.candidates[0].calibrated = 'forged'; result.resources.computedComponents = -1;
  expect(resultOnly(await evaluator.assess(entry))).toEqual(resultOnly(expected));
  expect(JSON.stringify(expected)).not.toMatch(/Private|movie:|tmdb|confidence|vector|descriptionHash/);
});

test('excludes whole shared-description groups, respects media scope and leaves sparse rivals in scope', async () => {
  const input = matchCalibrationFixture();
  input.documents.push({ ...input.documents[2], key: 'movie:999', id: 999, libraryIds: [2] });
  input.documents.push({ ...input.documents[0], key: 'movie:998', id: 998 });
  expect((await session(input).assess(input.entry)).candidates.map(row => row.referenceDescriptions)).toEqual([58, 60]);
  input.documents = input.documents.filter(doc => doc.libraryIds[0] !== 1 || doc.id <= 20);
  const evaluator = session(input), sparse = await evaluator.assess(input.entry);
  expect(sparse.candidates.every(row => row.status === 'sparse' && !row.calibrated)).toBe(true);
  const tv = input.documents.find(doc => doc.type === 'tv');
  expect(await evaluator.assess({ mediaType: 'tv', descriptionHash: tv.hash, heldDescriptionHashes: new Set([tv.hash]),
    itemIdentity: { mediaType: 'tv', tmdbId: tv.id } })).toMatchObject({ status: 'insufficient_libraries', candidates: [] });
});

test('aborted fits are evicted and retried; concurrently requested complete fits agree', async () => {
  const input = matchCalibrationFixture(), evaluator = session(input), controller = new AbortController();
  const pending = evaluator.assess(input.entry, { signal: controller.signal }); controller.abort();
  await expect(pending).rejects.toThrow();
  const [a, b] = await Promise.all([evaluator.assess(input.entry), evaluator.assess(input.entry)]);
  expect(resultOnly(a)).toEqual(resultOnly(b));
  await expect(evaluator.assess(input.entry, { signal: controller.signal })).rejects.toThrow();
});

test('validates cached queries and bounds model count', async () => {
  const input = matchCalibrationFixture(); input.documents = input.documents.slice(0, 30);
  const evaluator = session(input);
  for (let index = 1; index <= 20; index++) await evaluator.assess({ ...input.entry,
    heldDescriptionHashes: new Set([input.entry.descriptionHash, input.documents[index].hash]) });
  await expect(evaluator.assess(input.entry)).rejects.toThrow('fold_budget');
  for (const entry of [null, { ...input.entry, heldDescriptionHashes: new Set() },
    { ...input.entry, itemIdentity: { mediaType: 'tv', tmdbId: 1 } }, { ...input.entry, itemIdentity: { mediaType: 'movie', tmdbId: 2 } },
    { ...input.entry, heldDescriptionHashes: new Set([input.entry.descriptionHash, calibrationHash('unknown')]) }]) {
    await expect(evaluator.assess(entry)).rejects.toThrow();
  }
  expect(() => createPairedInventoryNeighborCalibration(input, { exact: 'true' })).toThrow('mode_invalid');
  expect(createPairedInventoryNeighborCalibration(input).exact).toBeUndefined();
});
