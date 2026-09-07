/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { httpPost } from '../utils/httpClient.mjs';

// Decoded response budget for single-item embeddings, not image input bytes.
// Allows large/custom vectors and response metadata; see the sizing design.
export const EMBEDDING_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

/** Preserve HTTP options while enforcing the embedding response boundary. */
export function postEmbeddingRequest(url, body, options = {}) {
  return httpPost(url, body, { ...options, maxResponseBytes: EMBEDDING_MAX_RESPONSE_BYTES });
}
