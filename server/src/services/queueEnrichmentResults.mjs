/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { canonicalMediaType } from './mediaIdentityValues.mjs';

export function omdbResultMatchesType(result, mediaType) {
  mediaType = canonicalMediaType(mediaType);
  if (!mediaType) return false;
  const declarations = [result?.type, result?.Type].filter((value) => value !== undefined);
  return declarations.length > 0 && declarations.every((value) =>
    (value === 'series' ? 'tv' : value === 'movie' ? 'movie' : null) === mediaType);
}
