/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createDescriptionVectorNormalizer } from '../../services/descriptionVectorNormalizer.mjs';
import { normalizeDescriptionVector } from '../../services/inventoryDescriptionSimilarity.mjs';
import { matchesNormalizedDescriptionVector } from '../../services/descriptionVectorArithmetic.mjs';

// Independent pre-change oracle. Do not rewrite this alongside production arithmetic.
function original(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map(value => value / norm);
}

function assertExact(actual, expected) {
  expect(Array.isArray(actual)).toBe(true);
  expect(actual.length).toBe(expected.length);
  for (let index = 0; index < expected.length; index++) {
    if (!Object.hasOwn(actual, index) || !Object.is(actual[index], expected[index])) {
      throw new Error(`normalization_mismatch_at_${index}`);
    }
  }
}

test('matches the old arithmetic exactly across dimensions, signs and scales', () => {
  const normalize = createDescriptionVectorNormalizer();
  const scales = [2 ** -149, 1e-30, 0.1, 1, 1e20, 3.4028234663852886e38];
  for (const length of [1, 2, 3, 31, 128, 1024, 1536, 16000]) {
    for (let seed = 0; seed < 12; seed++) {
      const vector = Object.freeze(Array.from({ length }, (_, i) =>
        i % 7 === 1 ? -0 : (i % 3 ? -1 : 1) * scales[(i + seed) % scales.length]));
      const expected = original(vector);
      const first = normalize(vector, length);
      assertExact(first, expected);
      assertExact(normalizeDescriptionVector(vector, length), expected);
      expect(normalize(vector, length)).toBe(first);
      // Some normalized extreme ratios fall below float32 range; those remain rejected.
      if (expected.every(value => value === 0 || Math.fround(value) !== 0)) {
        assertExact(normalize(first, length), original(expected));
        assertExact(normalizeDescriptionVector(first, length), original(expected));
      } else {
        expect(() => normalize(first, length)).toThrow();
        expect(() => normalizeDescriptionVector(first, length)).toThrow();
      }
    }
  }
});

test('preserves rounding for deterministic non-periodic vectors and repeated normalization', () => {
  let state = 0x12345678;
  const normalize = createDescriptionVectorNormalizer();
  for (let sample = 0; sample < 64; sample++) {
    const vector = Array.from({ length: 1 + sample * 17 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32 - 0.5;
    });
    const expected = original(vector), actual = normalize(vector, vector.length);
    assertExact(actual, expected);
    assertExact(normalizeDescriptionVector(vector, vector.length), expected);
    assertExact(normalize(actual, vector.length), original(expected));
  }
});

test('uses numeric traversal rather than caller-provided callback methods', () => {
  const vector = [3, 4, -0], expected = original(vector);
  const forbidden = () => { throw new Error('callback_path_used'); };
  Object.assign(vector, { reduce: forbidden, map: forbidden, every: forbidden });
  const normalize = createDescriptionVectorNormalizer();
  assertExact(normalizeDescriptionVector(vector, 3), expected);
  const result = normalize(vector, 3);
  assertExact(result, expected);
  expect(normalize(vector, 3)).toBe(result);
});

test.each(['length', 'hole', 'nan', 'signed_zero'])('repairs a borrowed output changed by %s', mutation => {
  const normalize = createDescriptionVectorNormalizer(), vector = [3, 4, -0];
  const first = normalize(vector, 3);
  if (mutation === 'length') first.push(1);
  if (mutation === 'hole') delete first[1];
  if (mutation === 'nan') first[0] = NaN;
  if (mutation === 'signed_zero') first[2] = 0;
  const result = normalize(vector, 3);
  expect(result).not.toBe(first);
  assertExact(result, original(vector));
});

test.each([0, NaN, Infinity, 1e100, 1e-100, '1'])('never accepts invalid cached input %s', value => {
  const vector = [1], normalize = createDescriptionVectorNormalizer();
  normalize(vector, 1);
  vector[0] = value;
  expect(() => normalize(vector, 1)).toThrow(expect.objectContaining({ code: 'INVALID_EMBEDDING' }));
});

test('cache matching agrees with Object.is across numeric bit patterns and corrupted values', () => {
  const values = [0, -0, NaN, Infinity, -Infinity, Number.MIN_VALUE, -Number.MIN_VALUE,
    Number.MAX_VALUE, -Number.MAX_VALUE, 1, -1, 0.1, undefined, null, '0', false, 0n,
    { valueOf() { throw new Error('must_not_coerce_borrowed_value'); } }];
  let state = 42;
  const bits = new DataView(new ArrayBuffer(8));
  for (let sample = 0; sample < 256; sample++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0; bits.setUint32(0, state);
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0; bits.setUint32(4, state);
    values.push(bits.getFloat64(0));
  }
  for (const value of values.filter(value => typeof value === 'number')) {
    for (const norm of [1, -1, 3, Number.MIN_VALUE, Number.MAX_VALUE, 0, -0, Infinity, NaN]) {
      const expected = value / norm;
      for (const actual of [expected, -expected, ...values.slice(0, 18)]) {
        expect(matchesNormalizedDescriptionVector([actual], [value], norm)).toBe(Object.is(actual, expected));
      }
    }
  }
});

test('matching preserves slot checks and does not read inherited values', () => {
  const previous = [0.6, 0.8];
  delete previous[1];
  Object.setPrototypeOf(previous, { get 1() { throw new Error('inherited_read'); } });
  expect(matchesNormalizedDescriptionVector(previous, [3, 4], 5)).toBe(false);
  expect(matchesNormalizedDescriptionVector(undefined, [3, 4], 5)).toBe(false);
  expect(matchesNormalizedDescriptionVector([0.6], [3, 4], 5)).toBe(false);
});

test('cache hits still revalidate parsed and cloned inputs and repair borrowed output types', () => {
  const normalize = createDescriptionVectorNormalizer();
  for (const vector of [JSON.parse('[0.1,-0.2,0.3]'), structuredClone([0.1, -0.2, 0.3])]) {
    for (const corrupt of ['0', null, undefined, Infinity, false, { valueOf: () => 1 }]) {
      const previous = normalize(vector, 3);
      previous[1] = corrupt;
      const repaired = normalize(vector, 3);
      expect(repaired).not.toBe(previous);
      assertExact(repaired, original(vector));
      expect(normalize(vector, 3)).toBe(repaired);
    }
    vector[1] = -0;
    assertExact(normalize(vector, 3), original(vector));
    delete vector[1];
    expect(() => normalize(vector, 3)).toThrow(expect.objectContaining({ code: 'INVALID_EMBEDDING' }));
  }
});
