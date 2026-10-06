/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { expect, test } from '@jest/globals';
import { updateInventoryVectorFingerprint } from '../../services/inventoryVectorFingerprint.mjs';

const fingerprint = (vectors, dimensions = 3) => {
  const digest = createHash('sha256');
  updateInventoryVectorFingerprint(digest, vectors, dimensions);
  return digest.digest('hex');
};
const rows = vector => new Map([['a'.repeat(64), vector]]);

test('preserves exact numbers, canonical zero, ordering and caller-owned vectors', () => {
  const vectors = new Map([['b'.repeat(64), [2, -0, 0]], ['a'.repeat(64), [1, 0, 0]]]);
  const before = structuredClone(vectors);
  expect(fingerprint(new Map([...vectors].reverse()))).toBe(fingerprint(vectors));
  expect(fingerprint(rows([1, -0, 0]))).toBe(fingerprint(rows([1, 0, 0])));
  expect(fingerprint(rows([1 + Number.EPSILON, 0, 0]))).not.toBe(fingerprint(rows([1, 0, 0])));
  expect(fingerprint(rows([1, 0, 0.25]))).not.toBe(fingerprint(rows([1, 0, 0])));
  expect(fingerprint(new Map([['b'.repeat(64), [1, 0, 0]]]))).not.toBe(fingerprint(rows([1, 0, 0])));
  expect(vectors).toEqual(before);
});

test('reuses one explicitly little-endian buffer and overwrites every component', () => {
  const buffers = [], encoded = [];
  const sink = { update(value) {
    if (Buffer.isBuffer(value)) { buffers.push(value); encoded.push(Buffer.from(value)); }
    return this;
  } };
  updateInventoryVectorFingerprint(sink, new Map([
    ['a'.repeat(64), [1.5, -2, -0]], ['b'.repeat(64), [3, 0, 0.25]],
  ]), 3);
  expect(buffers).toHaveLength(2);
  expect(buffers[0]).toBe(buffers[1]);
  expect(buffers[0].length).toBe(24);
  expect(encoded[0].toString('hex')).toBe('000000000000f83f00000000000000c00000000000000000');
  expect([0, 8, 16].map(offset => encoded[1].readDoubleLE(offset))).toEqual([3, 0, 0.25]);
});

test.each([NaN, Infinity, -Infinity, 1e100, 1e-100, '1', null, undefined])('rejects invalid component %p', value => {
  expect(() => fingerprint(rows([1, value, 0]))).toThrow();
});

test('rejects sparse, zero and inconsistent vectors and unbounded dimensions', () => {
  for (const vector of [[0, 0, 0], [1, , 0], [1, 0], new Float64Array([1, 0, 0])]) {
    expect(() => fingerprint(rows(vector))).toThrow();
  }
  for (const dimensions of [0, -1, 16001, 1.5, NaN, Infinity]) {
    expect(() => fingerprint(rows([1, 0, 0]), dimensions)).toThrow('multi_scale_source_invalid');
  }
  const maximum = Array(16000).fill(0); maximum[15999] = 1;
  expect(fingerprint(rows(maximum), 16000)).toMatch(/^[a-f0-9]{64}$/);
});
