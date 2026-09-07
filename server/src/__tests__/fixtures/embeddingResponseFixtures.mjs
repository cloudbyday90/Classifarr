/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export function embeddingVector(dimensions) {
  // Long finite numeric values exercise JSON expansion, not binary float sizes.
  return Array.from({ length: dimensions }, (_, index) =>
    index % 2 ? -0.12345678901234567 : 1.2345678901234567e-30);
}

export function embeddingResponse(shape, vector) {
  switch (shape) {
    case 'openai': return { data: [{ object: 'embedding', index: 0, embedding: vector }],
      model: 'fixture', usage: { total_tokens: 42 } };
    case 'gemini': return { embedding: { values: vector } };
    case 'cohere': return { embeddings: [vector], texts: ['Fixture 雪'], meta: { billed_units: { input_tokens: 42 } } };
    case 'ollama': return { embeddings: [vector], model: 'fixture', total_duration: 1000, prompt_eval_count: 42 };
    case 'vertex': return { predictions: [{ imageEmbedding: vector }], deployedModelId: 'fixture' };
    case 'sidecar': return { embedding: vector, dims: vector.length };
    default: throw new Error('Unknown embedding fixture shape');
  }
}

export const embeddingShapes = ['openai', 'gemini', 'cohere', 'ollama', 'vertex', 'sidecar'];

export function expandedEmbeddingResponse(shape) {
  return JSON.stringify({ ...embeddingResponse(shape, embeddingVector(16000)),
    texts: ['雪'.repeat(349525) + 'x'], metadata: { description: 'Large compatibility fixture' },
  }, null, 2);
}
