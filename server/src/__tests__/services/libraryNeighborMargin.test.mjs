/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { fitLibraryNeighborMargins } from '../../services/libraryNeighborMargin.mjs';

const vector = angle => [Math.cos(angle), Math.sin(angle)];
const groups = () => [0, Math.PI].map((offset, index) => ({ libraryId: index + 1,
  references: Array.from({ length: 30 }, (_, i) => vector(offset + i / 100)),
  calibration: Array.from({ length: 20 }, (_, i) => vector(offset + i / 90)) }));

test('positive margins require independent same-media calibration, not a probability', async () => {
  const model = await fitLibraryNeighborMargins(groups(), 2);
  expect(model.assess(vector(.1))).toMatchObject([
    { libraryId: 1, status: 'available', strict: true, mean: true, calibrated: true },
    { libraryId: 2, status: 'available', strict: false, mean: false, calibrated: false },
  ]);
  expect(model.assess(vector(1.4))[0]).toMatchObject({ mean: true, calibrated: false });
  expect(JSON.stringify(model)).toBe('{}');
});

test('isolates weakest-neighbor veto from top-three mean with identical references', async () => {
  const refs = similarities => similarities.map(value => [value, Math.sqrt(1 - value * value)]);
  const model = await fitLibraryNeighborMargins([
    { libraryId: 1, references: refs([.95, .94, .7]), calibration: [] },
    { libraryId: 2, references: refs([.8, .6, .5]), calibration: [] },
  ], 2);
  expect(model.assess([1, 0])[0]).toMatchObject({ status: 'sparse', referenceComplete: true, strict: false, mean: true, calibrated: false });
});

test('ties, degenerate calibration and one sparse rival cannot grant calibrated support', async () => {
  const tied = groups().map(group => ({ ...group, references: Array(20).fill([1, 0]), calibration: Array(20).fill([1, 0]) }));
  const model = await fitLibraryNeighborMargins(tied, 2);
  expect(model.assess([1, 0]).every(row => row.status === 'degenerate' && !row.strict && !row.mean && !row.calibrated)).toBe(true);
  const sparse = groups(); sparse[1].references = sparse[1].references.slice(0, 2);
  expect((await fitLibraryNeighborMargins(sparse, 2)).assess([1, 0]).every(row => row.status === 'sparse' && !row.referenceComplete && !row.calibrated)).toBe(true);
});

test('a positive mean is insufficient when rival calibration overlaps the proposed library', async () => {
  const input = groups(); input[1].calibration = input[0].calibration.map(value => [...value]);
  const result = (await fitLibraryNeighborMargins(input, 2)).assess(vector(.1));
  expect(result[0]).toMatchObject({ status: 'available', mean: true, calibrated: false });
});

test('copies numeric ownership before yielding and bounds invalid inputs and work', async () => {
  const input = groups(), pending = fitLibraryNeighborMargins(input, 2);
  input[0].references.forEach(value => value.fill(0)); input[1].calibration.length = 0;
  expect((await pending).assess(vector(.1))).toEqual((await fitLibraryNeighborMargins(groups(), 2)).assess(vector(.1)));
  for (const invalid of [[], [groups()[0]], [groups()[0], groups()[0]],
    [{ ...groups()[0], references: Array(65).fill([1, 0]) }, groups()[1]],
    [{ ...groups()[0], calibration: Array(33).fill([1, 0]) }, groups()[1]],
    [{ ...groups()[0], references: [[NaN, 1]] }, groups()[1]],
    [{ ...groups()[0], libraryId: -1 }, groups()[1]]]) {
    await expect(fitLibraryNeighborMargins(invalid, 2)).rejects.toThrow();
  }
  await expect(fitLibraryNeighborMargins(groups(), 0)).rejects.toThrow();
  await expect(fitLibraryNeighborMargins(Array.from({ length: 64 }, (_, i) => ({ libraryId: i + 1,
    references: Array(64).fill([]), calibration: [] })), 16000)).rejects.toThrow('vector_budget');
  await expect(fitLibraryNeighborMargins(groups(), 2, { consumeWork: () => { throw new Error('budget'); } })).rejects.toThrow('budget');
  const abort = new AbortController(), cancelled = fitLibraryNeighborMargins(groups(), 2, { signal: abort.signal }); abort.abort();
  await expect(cancelled).rejects.toThrow();
});
