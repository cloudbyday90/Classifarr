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
