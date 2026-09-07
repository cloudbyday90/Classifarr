/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding, validateEmbeddingResult, readEmbeddingResponse } from '../utils/embeddingValidation.mjs';
import { isRetryableError } from '../utils/retryUtils.mjs';

test.each([null, undefined, [], 'private response', {}, [0, -0], [NaN], [Infinity], [-Infinity],
  [1e39], [1e-50], [1, null], [true], ['1'], [[1]], new Array(2), new Float32Array([1]),
  new Array(16001).fill(1)])('rejects malformed vectors without exposing their contents: %#', vector => {
  let error;
  try { validateEmbedding(vector); } catch (caught) { error = caught; }
  expect(error).toMatchObject({ code: 'INVALID_EMBEDDING' });
  expect(error.message).not.toContain('private response');
  expect(error.cause).toBeUndefined();
  expect(error.response).toBeUndefined();
  expect(isRetryableError(error)).toBe(false);
});

test.each([0, -1, 1, 2.5, '2', null, Infinity])('rejects inconsistent reported dimensions: %p', dims => {
  expect(() => validateEmbedding([1, 2], dims)).toThrow(expect.objectContaining({ code: 'INVALID_EMBEDDING' }));
});

test('accepts float32 range and storage boundary without modifying the input', () => {
  for (const vector of [[0, -0, 1, -1, Math.fround(3.4028234e38), Math.fround(1e-45)], new Array(16000).fill(0.1)]) {
    const before = [...vector];
    expect(validateEmbedding(vector, vector.length)).toBe(vector);
    expect(vector).toEqual(before);
  }
  expect(() => validateEmbeddingResult({ embedding: [1] })).toThrow();
});

test.each(['openai', 'cohere', 'ollama', 'vertex'])('rejects ambiguous batch cardinality: %s', shape => {
  const data = { data: [{ embedding: [1] }, { embedding: [2] }], embeddings: [[1], [2]],
    predictions: [{ imageEmbedding: [1] }, { imageEmbedding: [2] }] };
  expect(() => readEmbeddingResponse(data, shape)).toThrow(expect.objectContaining({ code: 'INVALID_EMBEDDING' }));
});

test('supports legacy Ollama shape but does not hide a malformed modern response', () => {
  expect(readEmbeddingResponse({ embedding: [1] }, 'ollama')).toEqual([1]);
  expect(() => readEmbeddingResponse({ embeddings: [], embedding: [1] }, 'ollama')).toThrow();
  expect(() => readEmbeddingResponse({ embedding: [1], dims: null }, 'sidecar')).toThrow();
});
