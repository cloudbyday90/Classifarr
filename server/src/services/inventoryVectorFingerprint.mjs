/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Buffer } from 'node:buffer';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';

/** Append exact vectors to a synchronous hash using one bounded scratch buffer. */
export function updateInventoryVectorFingerprint(digest, vectors, dimensions) {
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000) {
    throw new Error('multi_scale_source_invalid');
  }
  const scratch = Buffer.alloc(dimensions * 8);
  digest.update(`inventory_vectors_float64le_v1:${dimensions}:`);
  for (const [hash, vector] of [...vectors].sort(([a], [b]) => a.localeCompare(b))) {
    validateEmbedding(vector, dimensions);
    for (let index = 0; index < dimensions; index++) {
      // JSON's previous identity treated -0 and +0 as equal. Keep exact nonzero values.
      scratch.writeDoubleLE(vector[index] === 0 ? 0 : vector[index], index * 8);
    }
    // Hash.update consumes bytes synchronously; never hand this buffer to async work.
    digest.update(hash).update(scratch);
  }
}
