/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { afterEach, expect, jest, test } from '@jest/globals';
import { createRepresentativeFingerprint, INVENTORY_REPRESENTATIVE_PROFILE_VERSION } from '../../services/inventoryRepresentativeFingerprint.mjs';
import { validateDescriptionRepresentation } from '../../services/inventoryDescriptionVectorCache.mjs';
import { validateInventoryVector } from '../../services/inventoryVectorValidation.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

afterEach(() => jest.restoreAllMocks());

// Frozen pre-reuse v4 encoder: never call the candidate to compute the expected bytes.
function legacyFingerprint(snapshot, identity, configKey) {
  const hash = createHash('sha256');
  const add = value => hash.update(JSON.stringify(value)).update('\n');
  add(['inventory_representative_profile_v4', validateDescriptionRepresentation(identity), configKey]);
  add(snapshot.libraries.map(row => [row.id, row.media_type]).sort((a, b) => a[0] - b[0]));
  add(snapshot.corpus.documents.map(row => [row.key, row.type, row.hash, [...row.libraryIds].sort((a, b) => a - b)])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return {
    append(key, present, value) {
      add([key, present]);
      if (!present) return;
      const vector = validateInventoryVector(value, identity.dimensions);
      const bytes = Buffer.allocUnsafe(vector.length * 4);
      vector.forEach((component, index) => bytes.writeFloatLE(component, index * 4));
      hash.update(bytes);
    },
    finish: () => hash.digest('hex'),
  };
}

function pair(dimensions = 2) {
  const { snapshot, identity } = representativeProfileFixture({ perLibrary: 1 });
  identity.dimensions = dimensions;
  return { identity, actual: createRepresentativeFingerprint(snapshot, identity, 'config'),
    expected: legacyFingerprint(snapshot, identity, 'config') };
}

test.each([1, 2, 256, 1024, 16000])('preserves exact v4 bytes at %i dimensions across parsed and cloned inputs', dimensions => {
  const { actual, expected } = pair(dimensions);
  const vector = Array.from({ length: dimensions }, (_, i) => (i % 17 + 1) / 19);
  for (const [index, value] of [vector, JSON.parse(JSON.stringify(vector)), structuredClone(vector)].entries()) {
    actual.append(String(index), true, value); expected.append(String(index), true, value);
  }
  actual.append('missing', false, null); expected.append('missing', false, null);
  expect(actual.finish()).toBe(expected.finish());
  expect(INVENTORY_REPRESENTATIVE_PROFILE_VERSION).toBe('inventory_representative_profile_v4');
});

test('preserves rounding, signed zero and float32 boundaries while fully overwriting storage', () => {
  const { actual, expected } = pair();
  for (const value of [[1, -0], [-1, 0], [1.00000006, -1.00000006], [2 ** -149, -(2 ** -149)],
    [3.4028234663852886e38, -3.4028234663852886e38]]) {
    actual.append('key', true, value); expected.append('key', true, value);
    value.fill(999); // Neither encoder may retain a caller's vector after append.
  }
  expect(actual.finish()).toBe(expected.finish());
});

test('allocates lazily, reuses exactly one bounded buffer and rejects updates after finish', () => {
  const { actual } = pair(16000);
  const allocate = jest.spyOn(Buffer, 'alloc');
  actual.append('missing', false);
  expect(allocate).not.toHaveBeenCalled();
  const vector = Array(16000).fill(1);
  for (let i = 0; i < 10; i++) actual.append(String(i), true, vector);
  expect(allocate).toHaveBeenCalledTimes(1);
  expect(allocate).toHaveBeenCalledWith(64000);
  actual.finish();
  expect(() => actual.finish()).toThrow();
  expect(() => actual.append('late', true, vector)).toThrow();
  expect(allocate).toHaveBeenCalledTimes(1);
});

test.each([
  ['shape', null], ['shape', new Float32Array([1, 2])], ['shape', []],
  ['dimensions', [1]], ['nonfinite', [1, NaN]], ['nonfinite', [1, Infinity]],
  ['nonfinite', [1, '2']], ['nonfinite', Array(2)], ['float32', [1, 1e40]],
  ['float32', [1, 1e-50]], ['zero', [0, -0]],
])('rejects %s before allocating', (issue, value) => {
  const { actual, expected } = pair();
  const allocate = jest.spyOn(Buffer, 'alloc');
  for (const encoder of [actual, expected]) {
    expect(() => encoder.append('bad', true, value)).toThrow(expect.objectContaining({
      code: 'INVALID_EMBEDDING', embeddingIssue: issue,
    }));
  }
  expect(allocate).not.toHaveBeenCalled();
});

test('rejects inherited sparse elements and retains validation on reused storage', () => {
  const { actual } = pair();
  actual.append('valid', true, [1, 2]);
  const value = [1, ,];
  Object.setPrototypeOf(value, Object.assign(Object.create(Array.prototype), { 1: 2 }));
  expect(() => actual.append('sparse', true, value)).toThrow(expect.objectContaining({ embeddingIssue: 'nonfinite' }));
});

test('keeps concurrent fingerprint instances independent', () => {
  const first = pair(), second = pair();
  for (let i = 0; i < 20; i++) {
    for (const [index, { actual, expected }] of [first, second].entries()) {
      const value = [i + 1, index ? -0.5 : 0.5];
      actual.append(String(i), true, value); expected.append(String(i), true, value);
    }
  }
  const firstKey = first.actual.finish(), secondKey = second.actual.finish();
  expect(firstKey).toBe(first.expected.finish());
  expect(secondKey).toBe(second.expected.finish());
  expect(firstKey).not.toBe(secondKey);
});

test('uses exact-size storage if the identity dimensions change between appends', () => {
  const { actual, expected, identity } = pair();
  for (const value of [[1, 2], [3], [4, 5, 6]]) {
    identity.dimensions = value.length;
    actual.append('key', true, value); expected.append('key', true, value);
  }
  expect(actual.finish()).toBe(expected.finish());
});

test('does not share borrowed storage with a reentrant append', () => {
  const { actual, expected } = pair();
  const encode = encoder => {
    encoder.append('first', true, [5, 6]);
    let reads = 0;
    const value = [1, 2];
    Object.defineProperty(value, 1, { get() {
      // Validation reads once; reenter during the subsequent encoding read.
      if (++reads === 2) encoder.append('nested', true, [9, 10]);
      return 2;
    } });
    encoder.append('outer', true, value);
    return encoder.finish();
  };
  expect(encode(actual)).toBe(encode(expected));
});

test('preserves finalization when an accessor finishes the hash during encoding', () => {
  const { actual, expected } = pair();
  const encode = encoder => {
    let reads = 0, digest;
    const value = [1, 2];
    Object.defineProperty(value, 1, { get() {
      if (++reads === 2) digest = encoder.finish();
      return 2;
    } });
    expect(() => encoder.append('outer', true, value)).toThrow();
    expect(() => encoder.finish()).toThrow();
    return digest;
  };
  expect(encode(actual)).toBe(encode(expected));
});
