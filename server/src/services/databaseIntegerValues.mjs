/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const MAX_DATABASE_BIGINT_ID = 9223372036854775807n;
export const MAX_DATABASE_INT32_ID = 2147483647;

/** Canonical positive PostgreSQL BIGINT, without rounding through a JavaScript number. */
export function canonicalDatabaseBigintId(value) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
  if (!['number', 'string'].includes(typeof value)) return null;
  const text = String(value);
  return /^[1-9][0-9]{0,18}$/.test(text) && BigInt(text) <= MAX_DATABASE_BIGINT_ID ? text : null;
}

/** Exact positive integer for identities stored as PostgreSQL INTEGER. */
export function parseCanonicalDatabaseInt32Id(value) {
  const canonical = canonicalDatabaseBigintId(value);
  return canonical !== null && BigInt(canonical) <= BigInt(MAX_DATABASE_INT32_ID) ? Number(canonical) : null;
}
