/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createInventoryNeighborCalibration, createPairedInventoryNeighborCalibration } from '../../services/inventoryNeighborCalibration.mjs';
import { matchCalibrationFixture, calibrationHash } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

function fixture() {
  const input = matchCalibrationFixture();
  for (let i = 0; i < 120; i++) {
    const id = 1000 + i, hash = calibrationHash(id), angle = i / 40;
    input.documents.push({ key: `movie:${id}`, id, type: 'movie', hash, libraryIds: [1] });
    input.vectors.set(hash, [Math.cos(angle), Math.sin(angle)]);
  }
  const query = input.vectors.get(input.entry.descriptionHash);
  input.entry.investigationCandidates = [1, 2].map(id => {
    const items = input.documents.filter(doc => doc.libraryIds[0] === id && !input.entry.heldDescriptionHashes.has(doc.hash))
      .map(doc => ({ hash: doc.hash, similarity: query.reduce((sum, value, index) => sum + value * input.vectors.get(doc.hash)[index], 0) }))
      .sort((a, b) => b.similarity - a.similarity);
    return { id, eligible: items.length, items: items.slice(0, 3) };
  });
  return input;
}
const options = { crossFit: true, referenceSelection: 'representative', diagnostics: true };

test('paired arms share an isolated snapshot and match independent sessions even after input mutation', async () => {
  const input = fixture(), pair = createPairedInventoryNeighborCalibration(input, { diagnostics: true });
  const ordered = await createInventoryNeighborCalibration(input, { crossFit: true, diagnostics: true }).assess(input.entry);
  const selected = await createInventoryNeighborCalibration(input, options).assess(input.entry);
  input.vectors.clear(); input.documents.length = 0; input.libraries.length = 0;
  expect(await pair.ordered.assess(input.entry)).toEqual(ordered);
  expect(await pair.representative.assess(input.entry)).toEqual(selected);
  const withoutDiagnostics = createPairedInventoryNeighborCalibration(fixture());
  expect((await withoutDiagnostics.ordered.assess(fixture().entry)).referenceCoverage).toBeUndefined();
});

test('uses a separate version/cache key, preserves reference and calibration sizes and exposes only numeric diagnostics', async () => {
  const input = fixture(), baseline = await createInventoryNeighborCalibration(input, { crossFit: true, diagnostics: true }).assess(input.entry);
  const selected = await createInventoryNeighborCalibration(input, options).assess(input.entry);
  expect(selected).toMatchObject({ version: 'library_neighbor_representative_cross_fit_v1', status: 'evaluated' });
  expect(selected.snapshotId).not.toBe(baseline.snapshotId);
  const counts = row => [row.referenceDescriptions, row.calibrationDescriptions, row.minimumCalibrationReferences];
  expect(selected.candidates.map(counts)).toEqual(baseline.candidates.map(counts));
  expect(selected.referenceCoverage.map(row => row.selectionStatus)).toEqual(['representative', 'unchanged_small']);
  expect(JSON.stringify(selected)).not.toMatch(/Private|hash|vector|movie:|tmdb|confidence/);
  input.documents.reverse(); input.libraries.reverse().forEach(row => { row.name = 'Ignored'; });
  expect(await createInventoryNeighborCalibration(input, options).assess(input.entry)).toEqual(selected);
});

test('copies target diagnostics before awaiting, retries after cancellation and validates cached query scope', async () => {
  const input = fixture(), model = createInventoryNeighborCalibration(input, options), controller = new AbortController();
  const pending = model.assess(input.entry, { signal: controller.signal }); controller.abort();
  await expect(pending).rejects.toThrow();
  const [first, second] = await Promise.all([model.assess(input.entry), model.assess(input.entry)]);
  expect(first).toEqual(second);
  const copy = fixture(), before = createInventoryNeighborCalibration(copy, options).assess(copy.entry);
  copy.entry.investigationCandidates[0].items[0].hash = 'mutated'; copy.vectors.clear();
  expect(await before).toEqual(first);
  await expect(model.assess({ ...input.entry, heldDescriptionHashes: new Set() })).rejects.toThrow('query_invalid');
});

test.each([{ referenceSelection: 'representative' }, { crossFit: true, referenceSelection: 'unknown' },
  { crossFit: true, diagnostics: 'yes' }, { diagnostics: true }])('rejects inconsistent selection options', invalid => {
  expect(() => createInventoryNeighborCalibration(fixture(), invalid)).toThrow('mode_invalid');
});
