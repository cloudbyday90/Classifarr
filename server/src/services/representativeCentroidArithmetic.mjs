/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { descriptionVectorNorm } from './descriptionVectorArithmetic.mjs';

/** Add to a private, dense sum; never alias it with the source vector. */
export function accumulateRepresentativeVector(sum, vector, dimensions) {
  // Validate every input before changing the sum, exactly as normalization does.
  validateEmbedding(vector, dimensions);
  const norm = descriptionVectorNorm(vector);
  // Preserve double-precision division and addition order without a temporary
  // normalized array. Reciprocal multiplication or float32 storage is not equivalent.
  for (let dimension = 0; dimension < dimensions; dimension++) {
    sum[dimension] += vector[dimension] / norm;
  }
}
