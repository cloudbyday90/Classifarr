/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

/**
 * Exact-identity lookup only. The comparison deliberately does not return
 * titles, descriptions, row IDs, or title/semantic matches, so synchronized
 * catalog text cannot become prompt content or a decision explanation.
 */
export const POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_SQL = `
  SELECT DISTINCT item.library_id
  FROM media_server_items AS item
  WHERE item.library_id = ANY($1::integer[])
    AND item.media_type = $2::text
    AND item.tmdb_id = $3::integer
  ORDER BY item.library_id ASC
`;

export function buildPolicyCandidateContrastiveRetrieverQuery(contract) {
  return Object.freeze({
    text: POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_SQL,
    values: [
      contract.candidates.map((candidate) => candidate.libraryId),
      contract.mediaType,
      contract.tmdbId,
    ],
  });
}
