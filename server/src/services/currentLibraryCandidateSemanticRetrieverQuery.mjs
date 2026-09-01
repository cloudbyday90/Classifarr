/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

/**
 * The stable TMDb join proves that every returned embedding still represents a
 * synchronized current-library item. The query returns titles and bounded
 * distances only; descriptions, raw metadata, embeddings, and identifiers do
 * not cross the retrieval boundary.
 */
export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL = `
  WITH nearest_embeddings AS MATERIALIZED (
    SELECT
      item.library_id,
      item.id AS media_item_id,
      item.title,
      item.year,
      embedding.embedding <=> $3::vector AS distance
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
    ORDER BY embedding.embedding <=> $3::vector ASC
    LIMIT $4::integer
  ), distinct_items AS (
    SELECT DISTINCT ON (library_id, media_item_id)
      library_id,
      media_item_id,
      title,
      year,
      distance
    FROM nearest_embeddings
    ORDER BY library_id ASC, media_item_id ASC, distance ASC
  ), ranked_items AS (
    SELECT
      library_id,
      title,
      year,
      distance,
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
    LEAST(100, GREATEST(0, ROUND((1 - distance) * 100)::integer)) AS relevance
  FROM ranked_items
  WHERE item_rank <= $5::integer
  ORDER BY library_id ASC, item_rank ASC
`;

export function buildCurrentLibraryCandidateSemanticRetrieverQuery(request, vectorString) {
  return Object.freeze({
    text: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL,
    values: [
      request.candidates.map((candidate) => candidate.libraryId),
      request.mediaType,
      vectorString,
      request.scanLimit,
      request.maximumItemsPerCandidate,
    ],
  });
}
