/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { reviewInteger } from './mediaIdentityReviewContract.mjs';
import { ServiceUnavailableError } from '../utils/appError.mjs';

/** Candidate-bound read only; never search for or persist an alternative identity. */
export async function getTmdbIdentityAlternativeTitles(id, mediaType, deps, { signal = null } = {}) {
  signal?.throwIfAborted();
  const tmdbId = reviewInteger(id);
  if (!['movie', 'tv'].includes(mediaType)) return null;
  const apiKey = await deps.getApiKey();
  signal?.throwIfAborted();
  if (!apiKey) throw new ServiceUnavailableError('TMDB API key not configured');
  const response = await deps.executeRateLimited(() => {
    signal?.throwIfAborted();
    return deps.httpGet(`${deps.baseUrl}/${mediaType}/${tmdbId}/alternative_titles`, {
      params: { api_key: apiKey }, timeout: 10000, maxResponseBytes: 1048576, redirect: 'error', signal,
    });
  }, { signal });
  signal?.throwIfAborted();
  return response.data;
}
