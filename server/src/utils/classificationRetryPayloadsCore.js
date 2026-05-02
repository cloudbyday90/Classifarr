/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Pure helpers for classification retry payload shaping.
 */

const metadataNormalization = require('./metadataNormalization');

const { normalizeMetadataList } = metadataNormalization;

function isFinitePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0;
}

function toPositiveInt(value) {
  return isFinitePositiveInt(value) ? Number.parseInt(value, 10) : null;
}

function normalizeTitle(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const asString = String(value).trim();
  return asString.length > 0 ? asString : null;
}

function safeParseJsonObject(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
}

function buildRetryIdentity(row = {}, metadata = {}) {
  return {
    tmdbId: toPositiveInt(row.tmdb_id ?? metadata.tmdb_id ?? metadata.tmdbId),
    mediaType: row.media_type || metadata.media_type || 'movie',
    title: normalizeTitle(row.title || metadata.title),
    year: normalizeYear(row.year || metadata.year),
  };
}

function buildRetryPayload(row = {}, metadata = {}, mediaItemId) {
  const mediaType = row.media_type || metadata.media_type || 'movie';
  const tmdbId = toPositiveInt(row.tmdb_id ?? metadata.tmdb_id ?? metadata.tmdbId);
  const tvdbId = toPositiveInt(metadata.tvdb_id ?? metadata.tvdbId);
  const year = row.year || metadata.year || null;
  const requestedSeasons = Array.isArray(metadata.requested_seasons) ? metadata.requested_seasons : null;
  const payload = {
    title: row.title || metadata.title || 'Unknown',
    year,
    tmdb_id: tmdbId,
    media_type: mediaType,
    overview: metadata.overview || '',
    genres: normalizeMetadataList(metadata.genres),
    keywords: normalizeMetadataList(metadata.keywords),
    content_rating: metadata.content_rating || metadata.certification || null,
    original_language: metadata.original_language || 'en',
    requested_seasons: requestedSeasons,
    include_specials: metadata.include_specials === true,
    retry_count: Number.isInteger(Number(row.retry_count)) ? Number(row.retry_count) : 0,
    max_retries: Number.isInteger(Number(row.max_retries)) && Number(row.max_retries) > 0
      ? Number(row.max_retries)
      : 3,
    source_library_id: toPositiveInt(metadata.source_library_id),
    source_library_name: metadata.source_library_name || null,
    itemId: toPositiveInt(mediaItemId || metadata.itemId || metadata.item_id || metadata.media_item_id),
    media: {
      media_type: mediaType,
      tmdbId,
      tvdbId,
      title: row.title || metadata.title || null,
      year,
    }
  };

  if (!requestedSeasons) delete payload.requested_seasons;
  if (!payload.itemId) delete payload.itemId;
  if (metadata.retry_lineage && typeof metadata.retry_lineage === 'object') {
    payload.retry_lineage = metadata.retry_lineage;
  }

  return payload;
}

function buildMetadataEnrichmentPayload(retryPayload = {}, metadata = {}, mediaItemId) {
  if (!mediaItemId) return null;

  return {
    title: retryPayload.title,
    year: retryPayload.year || null,
    overview: retryPayload.overview || '',
    genres: normalizeMetadataList(retryPayload.genres),
    keywords: normalizeMetadataList(retryPayload.keywords),
    content_rating: retryPayload.content_rating || null,
    original_language: retryPayload.original_language || 'en',
    tmdb_id: retryPayload.tmdb_id || null,
    tvdb_id: retryPayload.media?.tvdbId || null,
    imdb_id: metadata.imdb_id || metadata.imdbId || null,
    posterPath: metadata.posterPath || null,
    itemId: mediaItemId,
    source_library_id: retryPayload.source_library_id || null,
    source_library_name: retryPayload.source_library_name || null,
    media: {
      media_type: retryPayload.media_type || 'movie'
    }
  };
}

const classificationRetryPayloads = {
  buildMetadataEnrichmentPayload,
  buildRetryIdentity,
  buildRetryPayload,
  safeParseJsonObject,
  toPositiveInt,
};

module.exports = require('./classificationRetryPayloads.shared');
