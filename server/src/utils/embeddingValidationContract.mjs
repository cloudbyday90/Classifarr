/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// pgvector's storage limit; index and model compatibility are separate contracts.
export const MAX_VECTOR_DIMENSIONS = 16000;

export function invalidEmbedding(embeddingIssue) {
  return Object.assign(new Error('Embedding must contain a nonzero finite float32 vector with consistent dimensions'),
    { code: 'INVALID_EMBEDDING', embeddingIssue });
}
