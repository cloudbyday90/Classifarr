/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildCurrentLibraryCandidateRetrievalRequest,
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE,
} from './currentLibraryCandidateRetrievalContract.mjs';

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION =
  'current_library.candidate_semantic_retrieval.v2';
export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE =
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE;
export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SCAN_PER_CANDIDATE = 64;
export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_SCAN = 192;
export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_QUERY_LENGTH = 1_400;

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS = Object.freeze({
  READY: 'ready',
  NOT_APPLICABLE: 'not_applicable',
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
});

function boundedEmbeddingText(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_QUERY_LENGTH) : null;
}

/**
 * Reuses the lexical retriever's server-owned candidate boundary. Metadata can
 * contribute only the already configured embedding text; it cannot select a
 * library, alter the scan budget, or expose a retrieved description.
 */
export function buildCurrentLibraryCandidateSemanticRetrievalRequest({
  contract = null,
  metadata = null,
  formatForEmbedding = () => '',
} = {}) {
  const lexicalRequest = buildCurrentLibraryCandidateRetrievalRequest({ contract, metadata });
  if (lexicalRequest.statusId !== 'ready') {
    return Object.freeze({
      version: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
      statusId: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.NOT_APPLICABLE,
      candidates: Object.freeze([]),
    });
  }

  let formattedEmbeddingText = null;
  try {
    formattedEmbeddingText = formatForEmbedding(metadata || {});
  } catch (_error) {
    return Object.freeze({
      version: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
      statusId: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.UNAVAILABLE,
      candidates: lexicalRequest.candidates,
    });
  }

  const embeddingText = boundedEmbeddingText(formattedEmbeddingText);
  if (!embeddingText) {
    return Object.freeze({
      version: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
      statusId: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.NOT_APPLICABLE,
      candidates: Object.freeze([]),
    });
  }

  const candidateCount = lexicalRequest.candidates.length;
  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
    statusId: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.READY,
    candidates: lexicalRequest.candidates,
    embeddingText,
    maximumItemsPerCandidate: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE,
    mediaType: lexicalRequest.mediaType,
    scanLimit: Math.min(
      CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_MAXIMUM_SCAN,
      candidateCount * CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SCAN_PER_CANDIDATE,
    ),
  });
}
