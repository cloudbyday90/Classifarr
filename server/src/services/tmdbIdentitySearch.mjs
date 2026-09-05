/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildTmdbTitleRequest } from './tmdbTitleMatch.mjs';
import { ServiceUnavailableError } from '../utils/appError.mjs';

/** Preserve pagination and all first-page candidates; never use the display search mapper. */
export async function searchTmdbIdentityCandidates(title, mediaType, year, deps) {
  const request = buildTmdbTitleRequest(title, mediaType, year);
  if (!request) return null;
  const apiKey = await deps.getApiKey();
  if (!apiKey) throw new ServiceUnavailableError('TMDB API key not configured');
  const params = { api_key: apiKey, query: request.title, page: 1, include_adult: false };
  if (request.mediaType === 'movie') params.primary_release_year = String(request.year);
  else params.first_air_date_year = request.year;
  const response = await deps.executeRateLimited(() => deps.httpGet(`${deps.baseUrl}/search/${request.mediaType}`, {
    params, timeout: 10000,
  }));
  return response.data;
}
