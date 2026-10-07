/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { accumulateRepresentativeVector } from '../../services/representativeCentroidArithmetic.mjs';

// Frozen pre-change arithmetic: do not update this oracle with the implementation.
function original(sum, vector) {
  let squares = 0;
  for (let i = 0; i < vector.length; i++) squares += vector[i] * vector[i];
  const norm = Math.sqrt(squares), normalized = new Array(vector.length);
  for (let i = 0; i < vector.length; i++) normalized[i] = vector[i] / norm;
  for (let i = 0; i < vector.length; i++) sum[i] += normalized[i];
}

test.each([1, 2, 3, 31, 128, 1024, 1536, 16000])('preserves exact sums across %i dimensions and input histories', dimensions => {
  const actual = Array(dimensions).fill(-0), expected = [...actual];
  const scales = [2 ** -149, 1e-30, 0.1, 1, 1e20, 3.4028234663852886e38];
  for (let seed = 0; seed < 12; seed++) {
    const source = Array.from({ length: dimensions }, (_, i) =>
      i % 7 === 1 ? -0 : (i % 3 ? -1 : 1) * scales[(i + seed) % scales.length]);
    const vector = Object.freeze(seed % 2 ? structuredClone(source) : JSON.parse(JSON.stringify(source)));
    original(expected, vector);
    accumulateRepresentativeVector(actual, vector, dimensions);
    expect(actual.every((value, i) => Object.is(value, expected[i]))).toBe(true);
  }
});

test('preserves signed zero and cancellation without modifying the source', () => {
  const actual = [-0, 0, 0], expected = [...actual];
  for (const vector of [Object.freeze([-0, 3, 4]), Object.freeze([-0, -3, -4])]) {
    original(expected, vector); accumulateRepresentativeVector(actual, vector, 3);
    expect(actual.every((value, i) => Object.is(value, expected[i]))).toBe(true);
  }
  expect(Object.is(actual[0], -0)).toBe(true);
});

test.each([null, {}, [], [0, 0], [NaN, 1], [Infinity, 1], [1e100, 1], [1e-100, 1], Array(2), [1, '2'], [1], [1, 2, 3]]
  .map(vector => ({ vector })))('rejects malformed input without changing the sum: $vector', ({ vector }) => {
  const sum = [7, -0];
  expect(() => accumulateRepresentativeVector(sum, vector, 2)).toThrow(expect.objectContaining({ code: 'INVALID_EMBEDDING' }));
  expect(sum).toEqual([7, -0]);
});

test.each([0, 1.5, NaN, Infinity, '2', 3])('rejects invalid dimensions %s before mutation', dimensions => {
  const sum = [7, 8];
  expect(() => accumulateRepresentativeVector(sum, [3, 4], dimensions)).toThrow(expect.objectContaining({ embeddingIssue: 'dimensions' }));
  expect(sum).toEqual([7, 8]);
});

test('revalidates mutated and inherited input on each call', () => {
  const sum = [0, 0], vector = [3, 4];
  accumulateRepresentativeVector(sum, vector, 2);
  const before = [...sum]; vector[1] = NaN;
  expect(() => accumulateRepresentativeVector(sum, vector, 2)).toThrow();
  expect(sum).toEqual(before);
  const inherited = [3, ,];
  Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), { 1: 4 }));
  expect(() => accumulateRepresentativeVector(sum, inherited, 2)).toThrow();
  expect(sum).toEqual(before);
});
