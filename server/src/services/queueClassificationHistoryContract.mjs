/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { payloadMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';

/** Unknown identities must not become guessed movie records or title fallbacks. */
export function buildQueueClassificationHistoryIdentity(payload, tmdbId, libraryId) {
  const mediaType = payloadMediaType(payload);
  const normalizedLibraryId = positiveDatabaseInteger(libraryId);
  const normalizedTmdbId = tmdbId === null || tmdbId === undefined ? null : positiveDatabaseInteger(tmdbId);
  if (!normalizedLibraryId || !mediaType ||
      (tmdbId !== null && tmdbId !== undefined && normalizedTmdbId === null) ||
      typeof payload?.title !== 'string' || !payload.title.trim() || payload.title.length > 500) return null;

  return Object.freeze({
    libraryId: normalizedLibraryId,
    mediaType,
    title: payload.title,
    tmdbId: normalizedTmdbId,
  });
}
