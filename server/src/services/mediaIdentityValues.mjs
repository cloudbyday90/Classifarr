/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export function positiveDatabaseInteger(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^[0-9]{1,10}$/u.test(trimmed)) return null;
    value = Number(trimmed);
  }
  return Number.isInteger(value) && value > 0 && value <= 2_147_483_647 ? value : null;
}

export function canonicalMediaType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : null;
  return ['movie', 'tv'].includes(normalized) ? normalized : null;
}

/** All explicit declarations must agree; missing or invalid type is not a movie. */
export function payloadMediaType(payload) {
  const types = [payload?.media?.media_type, payload?.media_type]
    .filter((value) => value !== undefined).map(canonicalMediaType);
  return types.length > 0 && types.every((type) => type && type === types[0]) ? types[0] : null;
}
