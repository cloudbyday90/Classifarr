/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Frozen query builder from 6028bb09 for result-parity tests, not production use.
import { sourceConflictAuthorityExclusionForMediaServerItem } from '../../services/sourceConflictAuthorityGuard.mjs';

export function buildPreviousInventoryDescriptionCorpusSql({ includeCandidateMetadata = false, includeEvaluationMetadata = false,
  mediaTypeScoped = false } = {}) {
  return `
  SELECT msi.media_type, msi.tmdb_id, msi.library_id,
    ${includeCandidateMetadata ? 'msi.genres, msi.studio, msi.content_rating,' : ''}
    ${includeEvaluationMetadata ? `msi.title, msi.year,
      CASE WHEN octet_length((msi.metadata->'inventory_tmdb')::text) <= 100000
        THEN jsonb_build_object('inventory_tmdb', msi.metadata->'inventory_tmdb')
        ELSE '{}'::jsonb END AS evaluation_metadata,` : ''}
    left(COALESCE(
      CASE WHEN jsonb_typeof(msi.metadata->'overview')='string' THEN NULLIF(btrim(msi.metadata->>'overview'), '') END,
      CASE WHEN jsonb_typeof(msi.metadata->'summary')='string' THEN NULLIF(btrim(msi.metadata->>'summary'), '') END,
      CASE WHEN jsonb_typeof(history.metadata->'overview')='string' THEN history.metadata->>'overview' END, ''), 4000) AS overview
  FROM media_server_items msi
  JOIN libraries l ON l.id = msi.library_id AND l.is_active = true AND l.media_type = msi.media_type
  LEFT JOIN LATERAL (
    SELECT h.metadata FROM classification_history h
    WHERE h.media_type = msi.media_type AND h.tmdb_id = msi.tmdb_id
    ORDER BY h.created_at DESC, h.id DESC LIMIT 1
  ) history ON true
  WHERE msi.media_type IN ('movie', 'tv') ${mediaTypeScoped ? 'AND msi.media_type = $2::text ' : ''}AND msi.tmdb_id > 0
    AND ${sourceConflictAuthorityExclusionForMediaServerItem('$1')}
  ORDER BY msi.media_type, msi.tmdb_id, msi.library_id, msi.id
  LIMIT 50001
`;
}
