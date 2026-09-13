/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { fitLibraryNeighborCrossFit } from '../../services/libraryNeighborCrossFit.mjs';
import { calibrationHash } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

const vector = angle => [Math.cos(angle), Math.sin(angle)];
const groups = (count = 25) => [0, Math.PI].map((offset, index) => ({ libraryId: index + 1,
  references: Array.from({ length: count }, (_, i) => ({ hash: calibrationHash(`${index}:${i}`), vector: vector(offset + i / 100) })) }));

// Deliberately independent brute-force oracle: remove hashes, then cap, sort all scores.
function oracle(input, query) {
  const scores = (value, excluded) => input.map(group => group.references.filter(item => item.hash !== excluded).slice(0, 64)
    .map(item => Math.max(-1, Math.min(1, value.reduce((sum, part, i) => sum + part * item.vector[i], 0))))
    .sort((a, b) => b - a).slice(0, 3));
  const margins = values => values.map((value, i) => value.reduce((a, b) => a + b) / 3 -
    Math.max(...values.filter((_, j) => i !== j).map(other => other.reduce((a, b) => a + b) / 3)));
  const distributions = input.map(group => group.references.slice(0, 32).map(item => margins(scores(item.vector, item.hash))));
  const queryScores = scores(query), queryMargins = margins(queryScores);
  return input.map((group, i) => {
    const positive = distributions[i].map(row => row[i]).sort((a, b) => a - b);
    const threshold = Math.max(0, ...distributions.filter((_, j) => i !== j).map(rows => rows.map(row => row[i]).sort((a, b) => a - b)
      [Math.ceil((rows.length + 1) * .95) - 1]));
    const available = positive[Math.ceil((positive.length - 1) * .9)] - positive[Math.floor((positive.length - 1) * .1)] > 1e-6;
    return { libraryId: group.libraryId, status: available ? 'available' : 'degenerate',
      strict: Math.min(...queryScores[i]) > Math.max(...queryScores.filter((_, j) => i !== j).flat()), mean: queryMargins[i] > 0,
      calibrated: available && queryMargins[i] > threshold && (1 + positive.filter(value => value <= queryMargins[i]).length) / (positive.length + 1) > .05 };
  });
}

test.each([21, 25, 65])('matches group-excluded brute-force scoring with %i descriptions per library', async count => {
  const input = groups(count);
  let operations = 0;
  const model = await fitLibraryNeighborCrossFit(input, 2, { consumeWork: value => { operations += value; } });
  const referencesPerObservation = count === 65 ? 128 : 2 * count - 1;
  expect(operations).toBe(2 * Math.min(32, count) * referencesPerObservation * 2);
  for (const query of [vector(.12), vector(1.4), vector(Math.PI + .12)]) {
    expect(model.assess(query)).toMatchObject(oracle(input, query));
  }
  expect(model.assess(vector(.12))[0]).toMatchObject({ referenceDescriptions: Math.min(count, 64),
    calibrationDescriptions: Math.min(count, 32), minimumCalibrationReferences: Math.min(count - 1, 64) });
  expect(JSON.stringify(model)).toBe('{}');
});

test('requires twenty references after exclusion; sparse, degenerate and tied pools cannot authorize support', async () => {
  const sparse = groups(21); sparse[0].references.pop();
  const result = (await fitLibraryNeighborCrossFit(sparse, 2)).assess(vector(.12));
  expect(result.every(row => row.status === 'sparse' && !row.calibrated)).toBe(true);
  const tied = groups(21); tied.forEach(group => group.references.forEach(item => { item.vector = [1, 0]; }));
  expect((await fitLibraryNeighborCrossFit(tied, 2)).assess([1, 0]).every(row => row.status === 'degenerate' && !row.mean && !row.calibrated)).toBe(true);
  sparse[0].references = [];
  expect((await fitLibraryNeighborCrossFit(sparse, 2)).assess([1, 0]).every(row => !row.referenceComplete)).toBe(true);
});

test('copies references before yielding, bounds numeric work and supports cancellation', async () => {
  const expected = (await fitLibraryNeighborCrossFit(groups(), 2)).assess(vector(.12));
  const input = groups(), pending = fitLibraryNeighborCrossFit(input, 2);
  input.forEach(group => group.references.forEach(item => { item.vector.fill(0); item.hash = 'changed'; }));
  const model = await pending;
  const result = model.assess(vector(.12)); expect(result).toEqual(expected);
  result[0].calibrated = !result[0].calibrated;
  expect(model.assess(vector(.12))).toEqual(expected);
  await expect(fitLibraryNeighborCrossFit(groups(), 2, { consumeWork: () => { throw new Error('budget'); } })).rejects.toThrow('budget');
  const abort = new AbortController(), cancelled = fitLibraryNeighborCrossFit(groups(), 2, { signal: abort.signal }); abort.abort();
  await expect(cancelled).rejects.toThrow();
  await expect(fitLibraryNeighborCrossFit(groups(), 2, { signal: abort.signal })).rejects.toThrow();
});

test.each([
  input => { input[1].libraryId = input[0].libraryId; },
  input => { input[0].libraryId = 0; },
  input => { input[0].references.push(input[0].references[0]); },
  input => { input[1].references[0].hash = input[0].references[0].hash; },
  input => { input[0].references[0].hash = 'invalid'; },
  input => { input[0].references[0].vector = [0, 0]; },
  input => { input[0].references[0].vector = [Infinity, 1]; },
  input => { input[0].references = Array(66).fill(input[0].references[0]); },
])('rejects invalid or duplicated description groups before fitting', change => {
  const input = groups(); change(input);
  return expect(fitLibraryNeighborCrossFit(input, 2)).rejects.toThrow();
});

test('bounds group count, dimensions and vector memory before normalization', async () => {
  await expect(fitLibraryNeighborCrossFit([], 2)).rejects.toThrow();
  await expect(fitLibraryNeighborCrossFit(groups(), 0)).rejects.toThrow();
  await expect(fitLibraryNeighborCrossFit(Array.from({ length: 64 }, (_, i) => ({ libraryId: i + 1,
    references: Array(65).fill(null) })), 16000)).rejects.toThrow('vector_budget');
});
