/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';
import {
  heldOutSemanticStudyInventoryCandidate,
} from './heldOutSemanticStudyInventoryCandidate.mjs';

export const HELD_OUT_SEMANTIC_STUDY_INVENTORY_FRAME_PER_STRATUM = 96;

/**
 * Reads an identity-verified, deterministic inventory frame. It returns media
 * metadata only in process memory; callers must not serialize it.
 */
export async function readHeldOutSemanticStudyInventoryFrame({
  query,
  selectionSeed,
  perStratum = HELD_OUT_SEMANTIC_STUDY_INVENTORY_FRAME_PER_STRATUM,
  libraryIds = null,
} = {}) {
  if (typeof query !== 'function' || typeof selectionSeed !== 'string' || selectionSeed.length < 16 ||
      !Number.isInteger(perStratum) || perStratum < 24 || perStratum > 256) {
    throw new Error('invalid_held_out_inventory_frame_request');
  }
  if (libraryIds !== null && (!Array.isArray(libraryIds) || libraryIds.length > 64 ||
      libraryIds.some(id => !Number.isInteger(id) || id < 1 || id > 2_147_483_647))) {
    throw new Error('invalid_held_out_inventory_library_scope');
  }

  const result = await query(
    `WITH canonical_items AS (
       SELECT DISTINCT ON (msi.media_type, msi.tmdb_id)
         msi.id, msi.content_rating, msi.genres, msi.media_type, msi.metadata,
         msi.tmdb_id, msi.title, msi.year
       FROM media_server_items AS msi
       WHERE msi.media_type IN ('movie', 'tv')
         AND msi.tmdb_id > 0
         AND ($4::integer[] IS NULL OR msi.library_id = ANY($4::integer[]))
         AND msi.title IS NOT NULL
         AND btrim(msi.title) <> ''
         AND char_length(msi.title) <= 220
         AND ${sourceConflictAuthorityExclusionForMediaServerItem('$2')}
       ORDER BY msi.media_type, msi.tmdb_id, msi.id
     ), stratified AS (
       SELECT canonical_items.*,
         CASE
           WHEN 'Reality' = ANY(genres) THEN 'reality'
           WHEN 'Documentary' = ANY(genres) THEN 'documentary'
           WHEN cardinality(genres) >= 2 THEN 'genre-overlap'
           ELSE 'ordinary'
         END AS study_stratum
       FROM canonical_items
     ), ranked AS (
       SELECT stratified.*,
         row_number() OVER (
           PARTITION BY study_stratum
           ORDER BY md5($1::text || ':' || media_type || ':' || tmdb_id::text), id
         ) AS sample_rank
       FROM stratified
     )
     SELECT ranked.content_rating, ranked.genres, ranked.media_type, ranked.metadata,
       ranked.study_stratum, ranked.tmdb_id, ranked.title, ranked.year,
       history.metadata AS history_metadata
     FROM ranked
     LEFT JOIN LATERAL (
       SELECT metadata
       FROM classification_history
       WHERE tmdb_id = ranked.tmdb_id
         AND media_type = ranked.media_type
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) AS history ON true
     WHERE ranked.sample_rank <= $3
     ORDER BY ranked.sample_rank, ranked.study_stratum, ranked.media_type, ranked.tmdb_id`,
    [selectionSeed, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, perStratum, libraryIds],
  );

  const candidates = [];
  const identities = new Set();
  for (const row of result?.rows ?? []) {
    const candidate = heldOutSemanticStudyInventoryCandidate(row);
    const identity = `${candidate.metadata.media_type}:${candidate.metadata.tmdb_id}`;
    if (identities.has(identity)) throw new Error('duplicate_held_out_inventory_identity');
    identities.add(identity);
    candidates.push(candidate);
  }
  return Object.freeze(candidates);
}
