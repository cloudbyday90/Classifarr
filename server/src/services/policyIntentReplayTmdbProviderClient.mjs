/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function positiveIntegerOrNull(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMediaType(value) {
  return value === 'tv' ? 'tv' : 'movie';
}

export function createPolicyIntentReplayTmdbMetadataFetcher({ tmdbService } = {}) {
  if (!tmdbService || typeof tmdbService.getMovieDetails !== 'function') {
    throw new Error('TMDB replay metadata fetcher requires a TMDB service with getMovieDetails');
  }

  return async function fetchPolicyIntentReplayTmdbMetadata({
    tmdbId,
    mediaType = 'movie',
  } = {}) {
    const normalizedTmdbId = positiveIntegerOrNull(tmdbId);
    if (!normalizedTmdbId) {
      throw new Error('TMDB replay metadata fetcher requires a valid tmdbId');
    }

    const normalizedMediaType = normalizeMediaType(mediaType);
    if (normalizedMediaType === 'tv') {
      if (typeof tmdbService.getTVDetails !== 'function') {
        throw new Error('TMDB replay metadata fetcher requires getTVDetails for tv samples');
      }
      return tmdbService.getTVDetails(normalizedTmdbId);
    }

    return tmdbService.getMovieDetails(normalizedTmdbId);
  };
}
