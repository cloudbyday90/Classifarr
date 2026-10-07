/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { descriptionVectorNorm, divideDescriptionVector } from './descriptionVectorArithmetic.mjs';

export function normalizeDescriptionVector(vector, dimensions) {
  validateEmbedding(vector, dimensions);
  return divideDescriptionVector(vector, descriptionVectorNorm(vector));
}

export function descriptionCosineSimilarity(a, b) {
  return Math.max(-1, Math.min(1, a.reduce((sum, value, index) => sum + value * b[index], 0)));
}
