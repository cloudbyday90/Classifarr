/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';

/** Build-local allocation reuse. Consumers borrow results read-only. No validation bypass. */
export function createDescriptionVectorNormalizer() {
  const normalized = new WeakMap();
  return (vector, dimensions) => {
    validateEmbedding(vector, dimensions);
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    const previous = normalized.get(vector);
    // Recheck exact values even on hits: neither caller input nor borrowed output is trusted immutable.
    if (previous?.length === vector.length && vector.every((value, index) =>
      Object.hasOwn(previous, index) && Object.is(previous[index], value / norm))) return previous;
    const result = vector.map(value => value / norm);
    normalized.set(vector, result);
    return result;
  };
}
