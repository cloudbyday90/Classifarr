/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';

/** Unknown identities must not become guessed movie records or title fallbacks. */
export function buildQueueClassificationHistoryIdentity(payload, tmdbId, libraryId) {
  const declarations = [payload?.media?.media_type, payload?.media_type]
    .filter((value) => value !== undefined);
  const types = declarations.map(canonicalMediaType);
  const normalizedLibraryId = positiveDatabaseInteger(libraryId);
  const normalizedTmdbId = tmdbId === null || tmdbId === undefined ? null : positiveDatabaseInteger(tmdbId);
  if (!normalizedLibraryId || types.length === 0 || types.some((type) => !type) ||
      new Set(types).size !== 1 ||
      (tmdbId !== null && tmdbId !== undefined && normalizedTmdbId === null) ||
      typeof payload?.title !== 'string' || !payload.title.trim() || payload.title.length > 500) return null;

  return Object.freeze({
    libraryId: normalizedLibraryId,
    mediaType: types[0],
    title: payload.title,
    tmdbId: normalizedTmdbId,
  });
}
