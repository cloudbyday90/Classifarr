/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

export const HELD_OUT_SEMANTIC_STUDY_INVENTORY_FRAME_PER_STRATUM = 96;

const STRATA = Object.freeze(['documentary', 'genre-overlap', 'ordinary', 'reality']);

function positiveInteger(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 && numeric <= 2_147_483_647 ? numeric : null;
}

function boundedString(value, maximum) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sourceMetadata(row) {
  const historical = plainObject(row.history_metadata);
  const current = plainObject(row.metadata);
  return {
    certification: boundedString(historical.certification ?? row.content_rating, 40),
    genres: normalizeMetadataList(historical.genres ?? row.genres).slice(0, 24),
    keywords: normalizeMetadataList(historical.keywords).slice(0, 48),
    original_language: boundedString(historical.original_language, 32),
    overview: boundedString(historical.overview ?? current.summary, 4_000) ?? '',
    production_companies: normalizeMetadataList(historical.production_companies).slice(0, 48),
    rating: historical.rating ?? current.rating ?? null,
  };
}

/**
 * Reads an identity-verified, deterministic inventory frame. It returns media
 * metadata only in process memory; callers must not serialize it.
 */
export async function readHeldOutSemanticStudyInventoryFrame({
  query,
  selectionSeed,
  perStratum = HELD_OUT_SEMANTIC_STUDY_INVENTORY_FRAME_PER_STRATUM,
} = {}) {
  if (typeof query !== 'function' || typeof selectionSeed !== 'string' || selectionSeed.length < 16 ||
      !Number.isInteger(perStratum) || perStratum < 24 || perStratum > 256) {
    throw new Error('invalid_held_out_inventory_frame_request');
  }

  const result = await query(
    `WITH canonical_items AS (
       SELECT DISTINCT ON (msi.media_type, msi.tmdb_id)
         msi.id, msi.content_rating, msi.genres, msi.media_type, msi.metadata,
         msi.tmdb_id, msi.title, msi.year
       FROM media_server_items AS msi
       WHERE msi.media_type IN ('movie', 'tv')
         AND msi.tmdb_id > 0
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
    [selectionSeed, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, perStratum],
  );

  const candidates = [];
  const identities = new Set();
  for (const row of result?.rows ?? []) {
    const mediaType = row?.media_type;
    const tmdbId = positiveInteger(row?.tmdb_id);
    const title = boundedString(row?.title, 220);
    if (!['movie', 'tv'].includes(mediaType) || !tmdbId || !title || !STRATA.includes(row?.study_stratum)) {
      throw new Error('invalid_held_out_inventory_frame');
    }
    const identity = `${mediaType}:${tmdbId}`;
    if (identities.has(identity)) throw new Error('duplicate_held_out_inventory_identity');
    identities.add(identity);
    candidates.push(Object.freeze({
      metadata: Object.freeze({
        ...sourceMetadata(row),
        media_type: mediaType,
        title,
        tmdb_id: tmdbId,
        year: positiveInteger(row.year),
      }),
      stratum: row.study_stratum,
    }));
  }
  return Object.freeze(candidates);
}
