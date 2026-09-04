/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { heldOutSemanticStudyParameters } from './heldOutSemanticStudyScope.mjs';

/**
 * The stable TMDb join proves that every returned embedding still represents a
 * synchronized current-library item. The query returns titles and bounded
 * distances only. A receipt can mark an already-close result as eligible for
 * a bounded advisory calibration, but descriptions, raw metadata, embeddings,
 * receipt fields, and identifiers do not cross the retrieval boundary.
 */
function retrievalSql(heldOut = false) {
  return `
  WITH nearest_embeddings AS MATERIALIZED (
    SELECT
      item.library_id,
      item.id AS media_item_id,
      item.title,
      item.year,
      embedding.embedding <=> $3::vector AS distance,
      EXISTS (
        SELECT 1
        FROM policy_authorized_outcome_source_event_receipts AS receipt
        WHERE receipt.classification_id = history.id
          AND receipt.destination_library_id = item.library_id
          AND receipt.final_outcome_status_id IN ('resolved', 'routed')
          AND receipt.persistence_status_id = 'ready'
      ) AS has_authorized_outcome
    FROM classification_embeddings AS embedding
    JOIN classification_history AS history
      ON history.id = embedding.classification_id
    JOIN media_server_items AS item
      ON item.library_id = history.library_id
      AND item.media_type = history.media_type
      AND item.tmdb_id = history.tmdb_id
    WHERE embedding.is_stale = false
      AND embedding.embedding IS NOT NULL
      AND history.library_id = ANY($1::integer[])
      AND history.media_type = $2::text
      ${heldOut ? `AND history.tmdb_id > 0
      AND NOT EXISTS (
        SELECT 1 FROM unnest($6::text[], $7::integer[]) AS held(media_type, tmdb_id)
        WHERE held.media_type = history.media_type AND held.tmdb_id = history.tmdb_id
      )` : ''}
    ORDER BY embedding.embedding <=> $3::vector ASC${heldOut ? ', embedding.id ASC' : ''}
    LIMIT $4::integer
  ), distinct_items AS (
    SELECT DISTINCT ON (library_id, media_item_id)
      library_id,
      media_item_id,
      title,
      year,
      distance,
      has_authorized_outcome
    FROM nearest_embeddings
    ORDER BY library_id ASC, media_item_id ASC, distance ASC
  ), ranked_items AS (
    SELECT
      library_id,
      title,
      year,
      distance,
      has_authorized_outcome,
      row_number() OVER (
        PARTITION BY library_id
        ORDER BY distance ASC, media_item_id ASC
      ) AS item_rank
    FROM distinct_items
  )
  SELECT
    library_id,
    title,
    year,
    LEAST(100, GREATEST(0, ROUND((1 - distance) * 100)::integer)) AS relevance,
    has_authorized_outcome
  FROM ranked_items
  WHERE item_rank <= $5::integer
  ORDER BY library_id ASC, item_rank ASC
`;
}

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL = retrievalSql();
const HELD_OUT_SQL = retrievalSql(true);

export function buildCurrentLibraryCandidateSemanticRetrieverQuery(request, vectorString, heldOutScope) {
  return Object.freeze({
    text: heldOutScope === undefined ? CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL : HELD_OUT_SQL,
    values: [
      request.candidates.map((candidate) => candidate.libraryId),
      request.mediaType,
      vectorString,
      request.scanLimit,
      request.maximumItemsPerCandidate,
      ...(heldOutScope === undefined ? [] : heldOutSemanticStudyParameters(heldOutScope)),
    ],
  });
}
