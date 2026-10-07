/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { descriptionVectorNorm, divideDescriptionVector, matchesNormalizedDescriptionVector } from './descriptionVectorArithmetic.mjs';

/** Build-local allocation reuse. Consumers borrow results read-only. No validation bypass. */
export function createDescriptionVectorNormalizer() {
  const normalized = new WeakMap();
  return (vector, dimensions) => {
    validateEmbedding(vector, dimensions);
    const norm = descriptionVectorNorm(vector);
    const previous = normalized.get(vector);
    // Recheck exact values even on hits: neither caller input nor borrowed output is trusted immutable.
    if (matchesNormalizedDescriptionVector(previous, vector, norm)) return previous;
    const result = divideDescriptionVector(vector, norm);
    normalized.set(vector, result);
    return result;
  };
}
