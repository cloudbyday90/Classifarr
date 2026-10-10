/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { reviewInteger } from './mediaIdentityReviewContract.mjs';
import { ServiceUnavailableError } from '../utils/appError.mjs';

export async function getTmdbIdentitySeasonDetails(seriesId, seasonNumber, deps, { signal = null } = {}) {
  signal?.throwIfAborted();
  const id = reviewInteger(seriesId);
  if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 0 || seasonNumber > 10000) {
    throw new TypeError('invalid_catalog_season');
  }
  const apiKey = await deps.getApiKey();
  signal?.throwIfAborted();
  if (!apiKey) throw new ServiceUnavailableError('TMDB API key not configured');
  const response = await deps.executeRateLimited(() => {
    signal?.throwIfAborted();
    return deps.httpGet(`${deps.baseUrl}/tv/${id}/season/${seasonNumber}`, {
      params: { api_key: apiKey }, timeout: 10000, maxResponseBytes: 1048576, signal, redirect: 'error',
    });
  }, { signal });
  signal?.throwIfAborted();
  return response.data;
}
