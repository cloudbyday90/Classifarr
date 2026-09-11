/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {
  SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS,
  sourceConflictAuthorityExclusionForMediaServerItem,
} from './sourceConflictAuthorityGuard.mjs';

// The vector stays in SQL. Latest compatible representations are selected
// before distance ordering, so duplicate history cannot inflate the top three.
// Materialize that set before cosine ranking: exact search without disabling
// ordinary relational indexes. Fetch descriptions/receipts only after LIMIT.
export const INVENTORY_SEMANTIC_SAMPLE_SQL = `
  WITH query_embedding AS MATERIALIZED (
    SELECT e.embedding, e.provider, e.model, e.embedding_dims
    FROM classification_embeddings e
    JOIN classification_history h ON h.id = e.classification_id
    WHERE h.media_type = $1 AND h.tmdb_id = $2
      AND e.is_stale = false AND e.embedding IS NOT NULL
      AND e.embedding_dims = vector_dims(e.embedding)
      AND vector_norm(e.embedding) > 0
    ORDER BY e.updated_at DESC NULLS LAST, e.id DESC
    LIMIT 1
  )
  SELECT l.id AS library_id, l.name AS library_name,
    EXISTS (SELECT 1 FROM query_embedding) AS query_embedding_available,
    EXISTS (
      SELECT 1 FROM media_server_items msi
      WHERE msi.library_id = l.id AND msi.media_type = $1 AND msi.tmdb_id = $2
        AND ${sourceConflictAuthorityExclusionForMediaServerItem('$6')}
    ) AS observed_membership,
    neighbor.tmdb_id, left(details.title, 220) AS title, details.year, details.genres,
    left(COALESCE(NULLIF(details.metadata->>'overview', ''),
      NULLIF(details.metadata->>'summary', ''), history.metadata->>'overview', ''), 4000) AS overview,
    neighbor.similarity,
    EXISTS (
      SELECT 1 FROM policy_authorized_outcome_source_event_receipts r
      WHERE r.classification_id = neighbor.classification_id AND r.destination_library_id = l.id
        AND r.persistence_status_id = 'ready'
        AND r.final_outcome_status_id IN ('resolved', 'routed')
    ) AS has_authorized_outcome
  FROM libraries l
  LEFT JOIN LATERAL (
    WITH latest AS MATERIALIZED (
      SELECT DISTINCT ON (msi.tmdb_id)
        msi.tmdb_id, msi.id AS media_item_id, h.id AS classification_id, e.embedding
      FROM media_server_items msi
      JOIN classification_history h
        ON h.media_type = msi.media_type AND h.tmdb_id = msi.tmdb_id
      JOIN classification_embeddings e ON e.classification_id = h.id
      CROSS JOIN query_embedding q
      WHERE msi.library_id = l.id AND msi.media_type = $1 AND msi.tmdb_id > 0
        AND btrim(msi.title) <> ''
        AND ${sourceConflictAuthorityExclusionForMediaServerItem('$6')}
        AND NOT EXISTS (
          SELECT 1 FROM unnest($4::text[], $5::integer[]) held(media_type, tmdb_id)
          WHERE held.media_type = msi.media_type AND held.tmdb_id = msi.tmdb_id
        )
        AND e.is_stale = false AND e.embedding IS NOT NULL
        AND e.provider = q.provider AND e.model = q.model
        AND e.embedding_dims = q.embedding_dims
        AND vector_dims(e.embedding) = q.embedding_dims
        AND vector_norm(e.embedding) > 0
      ORDER BY msi.tmdb_id, e.updated_at DESC NULLS LAST, e.id DESC, msi.id
    )
    SELECT latest.tmdb_id, latest.media_item_id, latest.classification_id,
      1 - (latest.embedding <=> q.embedding) AS similarity
    FROM latest CROSS JOIN query_embedding q
    ORDER BY latest.embedding <=> q.embedding, latest.tmdb_id
    LIMIT 3
  ) neighbor ON true
  LEFT JOIN media_server_items details ON details.id = neighbor.media_item_id
  LEFT JOIN classification_history history ON history.id = neighbor.classification_id
  WHERE l.is_active = true AND l.media_type = $1 AND l.id = ANY($3::integer[])
  ORDER BY l.id, neighbor.similarity DESC, neighbor.tmdb_id
`;

export function inventorySemanticSampleParameters(candidate, cohort, libraries) {
  return [
    candidate.metadata.media_type,
    candidate.metadata.tmdb_id,
    libraries.map(library => library.id),
    cohort.map(item => item.metadata.media_type),
    cohort.map(item => item.metadata.tmdb_id),
    SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS,
  ];
}
