/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { MAX_VECTOR_DIMENSIONS, invalidEmbedding } from '../utils/embeddingValidationContract.mjs';

/**
 * Same contract as validateEmbedding, with independent optimizer feedback for
 * inventory reads. Keep the small loop separate: a factory shares feedback and
 * cloned provider/worker arrays can otherwise make V8 box every parsed vector.
 * Both implementations run the same semantic and differential regression suite.
 * This is not a trusted-input path: revalidate every value on every call.
 */
export function validateInventoryVector(embedding, dims = undefined) {
  if (!Array.isArray(embedding) || embedding.length < 1 || embedding.length > MAX_VECTOR_DIMENSIONS) throw invalidEmbedding('shape');
  if (dims !== undefined && (!Number.isInteger(dims) || dims !== embedding.length)) throw invalidEmbedding('dimensions');
  let nonzero = false;
  for (let index = 0; index < embedding.length; index++) {
    const value = embedding[index];
    if (!Object.hasOwn(embedding, index) || !Number.isFinite(value)) throw invalidEmbedding('nonfinite');
    const float = Math.fround(value);
    if (!Number.isFinite(float) || (value !== 0 && float === 0)) throw invalidEmbedding('float32');
    nonzero ||= float !== 0;
  }
  if (!nonzero) throw invalidEmbedding('zero');
  return embedding;
}
