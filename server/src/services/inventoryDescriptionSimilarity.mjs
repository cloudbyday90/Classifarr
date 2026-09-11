/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';

export function normalizeDescriptionVector(vector, dimensions) {
  validateEmbedding(vector, dimensions);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map(value => value / norm);
}

export function descriptionCosineSimilarity(a, b) {
  return Math.max(-1, Math.min(1, a.reduce((sum, value, index) => sum + value * b[index], 0)));
}
