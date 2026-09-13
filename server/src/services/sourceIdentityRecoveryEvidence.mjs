/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { buildTmdbTitleRequest } from './tmdbTitleMatch.mjs';

const FIELDS = ['tmdb_id', 'imdb_id', 'tvdb_id'];

/** Transient evidence only; never persist or log the candidate arrays. */
export function sourceIdentityRecoveryEvidence(item, libraryKey, providerIds) {
  const request = buildTmdbTitleRequest(item?.title, item?.media_type, item?.year);
  if (!request || typeof item.external_id !== 'string' || !item.external_id.trim() ||
      item.external_id.length > 500 || typeof libraryKey !== 'string' || !libraryKey ||
      !providerIds || Object.keys(providerIds).length !== FIELDS.length) return null;
  const candidates = {};
  for (const field of FIELDS) {
    const values = providerIds[field];
    if (!Array.isArray(values) || values.length > 20 || Array.from(values).some(value => field === 'imdb_id'
      ? typeof value !== 'string' || !/^tt[0-9]{1,12}$/u.test(value)
      : !Number.isSafeInteger(value) || value < 1 || value > 2147483647) ||
      new Set(values).size !== values.length) return null;
    candidates[field] = [...values].sort();
  }
  const snapshotDigest = createHash('sha256').update(JSON.stringify([
    item.external_id, libraryKey, request.mediaType, request.normalizedTitle, request.year, candidates,
  ])).digest('hex');
  return { mediaType: request.mediaType, providerIds: candidates, snapshotDigest };
}
