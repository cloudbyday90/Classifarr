/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { validateEmbedding } from '../../utils/embeddingValidation.mjs';
import { validateInventoryVector } from '../../services/inventoryVectorValidation.mjs';
import { decodeInventoryDescriptionVectorRows } from '../../services/inventoryDescriptionVectorDecoding.mjs';
import { createInventoryVectorFingerprint } from '../../services/inventoryVectorFingerprint.mjs';
import { createHash } from 'node:crypto';
import { isRetryableError } from '../../utils/retryUtils.mjs';

function outcome(validate, vector, dimensions) {
  try {
    expect(validate(vector, dimensions)).toBe(vector);
    return { valid: true };
  } catch (error) {
    expect(error).toMatchObject({ code: 'INVALID_EMBEDDING' });
    expect(error.cause).toBeUndefined();
    expect(error.response).toBeUndefined();
    expect(isRetryableError(error)).toBe(false);
    return { code: error.code, issue: error.embeddingIssue, message: error.message };
  }
}

test('inventory and general validation agree for malformed shapes, dimensions and deterministic numeric cases', () => {
  const cases = [null, undefined, 'private payload', {}, [], [0, -0], [NaN], [Infinity], [-Infinity],
    [true], ['1'], [null], [[1]], [1, , 2], new Float64Array([1]), new Array(16001).fill(1)];
  let seed = 42;
  const view = new DataView(new ArrayBuffer(8));
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let sample = 0; sample < 200; sample++) {
    view.setUint32(0, next()); view.setUint32(4, next());
    const value = view.getFloat64(0);
    cases.push([1, value], [1, Math.fround(value)]);
  }
  for (const vector of cases) for (const dimensions of [undefined, 2, 0, 2.5, null, '2']) {
    expect(outcome(validateInventoryVector, vector, dimensions)).toEqual(outcome(validateEmbedding, vector, dimensions));
  }
});

test('decode and fingerprint retain full validation after general cloned-array history and later mutation', () => {
  for (let index = 0; index < 512; index++) validateEmbedding(structuredClone([0.1, 1]), 2);
  const hash = 'a'.repeat(64);
  const decoded = decodeInventoryDescriptionVectorRows([{ description_hash: hash, embedding: '[0.1,-0]' }], { dimensions: 2 });
  const vector = decoded.get(hash);
  expect(vector[0]).toBe(0.1);
  expect(Object.is(vector[1], -0)).toBe(true);
  const append = createInventoryVectorFingerprint(createHash('sha256'), 2);
  append(hash, vector);
  vector[1] = NaN;
  expect(() => append(hash, vector)).toThrow(expect.objectContaining({ code: 'INVALID_EMBEDDING', embeddingIssue: 'nonfinite' }));
  for (const embedding of ['[1,null]', '[1,1e309]', '[1,1e-100]', '[0,0]', '{}', '[1]']) {
    expect(() => decodeInventoryDescriptionVectorRows([{ description_hash: hash, embedding }], { dimensions: 2 })).toThrow();
  }
});
