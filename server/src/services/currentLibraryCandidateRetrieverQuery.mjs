/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const SEARCH_DOCUMENT = `to_tsvector(
  'simple',
  concat_ws(
    ' ',
    item.title,
    item.original_title,
    array_to_string(item.genres, ' '),
    array_to_string(item.tags, ' '),
    item.studio,
    item.metadata ->> 'summary',
    item.metadata ->> 'overview'
  )
)`;

/**
 * The only full-text query here is plainto_tsquery: the title remains data and
 * cannot introduce tsquery operators. This query returns no description or
 * other raw metadata, even though those fields can help rank a result.
 */
export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_SQL = `
  WITH search_query AS (
    SELECT plainto_tsquery('simple', $5::text) AS terms
  ), matching_items AS (
    SELECT
      item.library_id,
      item.title,
      item.year,
      item.id,
      CASE
        WHEN $3::integer IS NOT NULL AND item.tmdb_id = $3::integer THEN 'identifier'
        WHEN lower(item.title) = lower($4::text)
          AND ($6::integer IS NULL OR item.year = $6::integer) THEN 'title_year'
        ELSE 'text'
      END AS match_kind,
      CASE
        WHEN $3::integer IS NOT NULL AND item.tmdb_id = $3::integer THEN 100
        WHEN lower(item.title) = lower($4::text)
          AND ($6::integer IS NULL OR item.year = $6::integer) THEN 90
        ELSE LEAST(89, GREATEST(1, ROUND(ts_rank_cd(${SEARCH_DOCUMENT}, search_query.terms) * 100)::integer))
      END AS relevance
    FROM media_server_items AS item
    CROSS JOIN search_query
    WHERE item.library_id = ANY($1::integer[])
      AND item.media_type = $2::text
      AND (
        ($3::integer IS NOT NULL AND item.tmdb_id = $3::integer)
        OR (
          lower(item.title) = lower($4::text)
          AND ($6::integer IS NULL OR item.year = $6::integer)
        )
        OR (${SEARCH_DOCUMENT} @@ search_query.terms)
      )
  ), ranked_items AS (
    SELECT
      library_id,
      title,
      year,
      match_kind,
      relevance,
      row_number() OVER (
        PARTITION BY library_id
        ORDER BY relevance DESC, id ASC
      ) AS item_rank
    FROM matching_items
  )
  SELECT library_id, title, year, match_kind, relevance
  FROM ranked_items
  WHERE item_rank <= $7::integer
  ORDER BY library_id ASC, item_rank ASC
`;

export function buildCurrentLibraryCandidateRetrieverQuery(request) {
  return Object.freeze({
    text: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_SQL,
    values: [
      request.candidates.map((candidate) => candidate.libraryId),
      request.mediaType,
      request.tmdbId,
      request.title,
      request.searchText,
      request.year,
      request.maximumItemsPerCandidate,
    ],
  });
}
