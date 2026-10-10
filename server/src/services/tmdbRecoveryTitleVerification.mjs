/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildTmdbTitleRequest, normalizeIdentityTitle, readTmdbIdentityTitleDetails } from './tmdbTitleMatch.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';

const reject = reason => ({ tmdbId: null, reason });

/** Only call after independent external IDs agree on a declared source candidate. */
export async function verifyTmdbRecoveryTitle(item, candidateId, details, tmdbService, { signal = null } = {}) {
  signal?.throwIfAborted();
  const request = buildTmdbTitleRequest(item.title, item.media_type, item.year);
  const parsed = readTmdbIdentityTitleDetails(details, request?.mediaType);
  if (!request) return reject('title_year_mismatch');
  if (!parsed || parsed.id !== candidateId) return reject('provider_response_invalid');
  if (parsed.year !== request.year) return reject('title_year_mismatch');
  if (parsed.titles.includes(request.normalizedTitle)) return { tmdbId: candidateId };
  const response = await tmdbService.getIdentityAlternativeTitles(candidateId, request.mediaType, { signal });
  signal?.throwIfAborted();
  const rows = request.mediaType === 'movie' ? response?.titles : response?.results;
  if (positiveDatabaseInteger(response?.id) !== candidateId || !Array.isArray(rows) || rows.length > 100) {
    return reject('provider_response_invalid');
  }
  const titles = rows.map(row => normalizeIdentityTitle(row?.title));
  if (titles.some(title => !title)) return reject('provider_response_invalid');
  return titles.includes(request.normalizedTitle) ? { tmdbId: candidateId } : reject('title_year_mismatch');
}
