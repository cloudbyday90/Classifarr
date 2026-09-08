/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

export const HELD_OUT_SEMANTIC_STUDY_STRATA = Object.freeze([
  'documentary',
  'genre-overlap',
  'ordinary',
  'reality',
]);

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

/** Creates an in-memory study candidate; callers must not serialize metadata. */
export function heldOutSemanticStudyInventoryCandidate(row = {}) {
  const mediaType = row?.media_type;
  const tmdbId = positiveInteger(row?.tmdb_id);
  const title = boundedString(row?.title, 220);
  if (!['movie', 'tv'].includes(mediaType) || !tmdbId || !title ||
      !HELD_OUT_SEMANTIC_STUDY_STRATA.includes(row?.study_stratum)) {
    throw new Error('invalid_held_out_inventory_frame');
  }
  return Object.freeze({
    metadata: Object.freeze({
      ...sourceMetadata(row),
      media_type: mediaType,
      title,
      tmdb_id: tmdbId,
      year: positiveInteger(row.year),
    }),
    stratum: row.study_stratum,
  });
}
