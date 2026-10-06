/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createDescriptionVectorNormalizer } from '../../services/descriptionVectorNormalizer.mjs';
import { normalizeDescriptionVector } from '../../services/inventoryDescriptionSimilarity.mjs';

test('reuses exact normalized arrays, without modifying inputs or sharing across factories', () => {
  const normalize = createDescriptionVectorNormalizer();
  for (const vector of [[3, 4, -0], [0.1, -0.2, 0.3], [1e-30, 1e30, -2e20], [Number.MIN_VALUE * 1e300, 1, -1]]) {
    const before = [...vector], result = normalize(vector, vector.length);
    expect(result).toEqual(normalizeDescriptionVector(vector, vector.length));
    expect(normalize(vector, vector.length)).toBe(result);
    expect(result).not.toBe(vector);
    expect(vector).toEqual(before);
    expect(createDescriptionVectorNormalizer()(vector, vector.length)).not.toBe(result);
  }
  const vector = [3, 4, -0];
  expect(Object.is(normalize(vector, 3)[2], -0)).toBe(true);
  expect(Object.isFrozen(vector)).toBe(false);
});

test('revalidates dimensions, input changes and borrowed-result changes on every lookup', () => {
  const normalize = createDescriptionVectorNormalizer(), vector = [3, 4];
  const first = normalize(vector, 2);
  expect(() => normalize(vector, 3)).toThrow();
  vector[0] = 4;
  const second = normalize(vector, 2);
  expect(second).not.toBe(first);
  expect(second).toEqual(normalizeDescriptionVector(vector, 2));
  second[0] = NaN;
  const third = normalize(vector, 2);
  expect(third).not.toBe(second);
  expect(third).toEqual(normalizeDescriptionVector(vector, 2));
  delete third[0];
  expect(normalize(vector, 2)).toEqual(normalizeDescriptionVector(vector, 2));
  vector[0] = NaN;
  expect(() => normalize(vector, 2)).toThrow();
});

test.each([null, {}, [], [0, 0], [NaN, 1], [Infinity, 1], [1e100, 1], [1e-100, 1], Array(2), [1, '2']]
  .map(vector => ({ vector })))('rejects malformed vectors rather than caching them: $vector', ({ vector }) => {
  expect(() => createDescriptionVectorNormalizer()(vector, 2)).toThrow();
});

test('preserves the second normalization when the graph receives first-normalized vectors', () => {
  const normalize = createDescriptionVectorNormalizer(), vector = [0.1, -0.2, 0.3];
  const once = normalize(vector, 3), twice = normalize(once, 3);
  expect(twice).toEqual(normalizeDescriptionVector(normalizeDescriptionVector(vector, 3), 3));
  expect(twice).not.toBe(once);
  expect(twice).not.toEqual(once); // Regression fixture: normalization is not idempotent.
});
