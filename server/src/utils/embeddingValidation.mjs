/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// pgvector's storage limit; index and model compatibility are separate contracts.
const MAX_VECTOR_DIMENSIONS = 16000;

function invalidEmbedding(embeddingIssue) {
  return Object.assign(new Error('Embedding must contain a nonzero finite float32 vector with consistent dimensions'),
    { code: 'INVALID_EMBEDDING', embeddingIssue });
}

/** Reject malformed data without coercion, normalization, or logging payloads. */
export function validateEmbedding(embedding, dims = undefined) {
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

export function validateEmbeddingResult(result) {
  if (!Number.isInteger(result?.dims)) throw invalidEmbedding('dimensions');
  validateEmbedding(result.embedding, result.dims);
  return result;
}

/** These adapters submit one input, so a batch response must contain one vector. */
function single(entries) {
  if (!Array.isArray(entries) || entries.length !== 1) throw invalidEmbedding('batch');
  return entries[0];
}

export function readEmbeddingResponse(data, shape) {
  let embedding;
  switch (shape) {
    case 'openai': embedding = single(data?.data)?.embedding; break;
    case 'gemini': embedding = data?.embedding?.values; break;
    case 'cohere': embedding = single(data?.embeddings); break;
    case 'vertex': embedding = single(data?.predictions)?.imageEmbedding; break;
    case 'ollama': embedding = data?.embeddings !== undefined ? single(data.embeddings) : data?.embedding; break;
    case 'sidecar': return validateEmbedding(data?.embedding, data?.dims);
    default: throw invalidEmbedding('unsupported_response');
  }
  return validateEmbedding(embedding);
}
