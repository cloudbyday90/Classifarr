/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';

export function typedTmdbResults(results, mediaType) {
  mediaType = canonicalMediaType(mediaType);
  if (!Array.isArray(results) || !mediaType) return [];
  return results.filter((result) => result && positiveDatabaseInteger(result.id) &&
    (result.media_type === undefined || canonicalMediaType(result.media_type) === mediaType));
}

export function omdbResultMatchesType(result, mediaType) {
  mediaType = canonicalMediaType(mediaType);
  if (!mediaType) return false;
  const declarations = [result?.type, result?.Type].filter((value) => value !== undefined);
  return declarations.length > 0 && declarations.every((value) =>
    (value === 'series' ? 'tv' : value === 'movie' ? 'movie' : null) === mediaType);
}

export function omdbImdbId(result, mediaType) {
  if (!omdbResultMatchesType(result, mediaType)) return null;
  const ids = [result.imdbId, result.imdbID].filter((value) => value !== undefined);
  return ids.length > 0 && ids.every((id) => typeof id === 'string' && /^tt[0-9]{1,12}$/u.test(id) && id === ids[0])
    ? ids[0] : null;
}
