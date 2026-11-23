/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const MAX_DATABASE_BIGINT_ID = 9223372036854775807n;
const MAX_DATABASE_INT32_ID = 2147483647n;

/** Canonical positive PostgreSQL BIGINT, without rounding through a JavaScript number. */
export function canonicalDatabaseBigintId(value) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
  if (!['number', 'string'].includes(typeof value)) return null;
  const text = String(value);
  return /^[1-9][0-9]{0,18}$/.test(text) && BigInt(text) <= MAX_DATABASE_BIGINT_ID ? text : null;
}

/** JSON-compatible database ID with an exact decimal string above the safe range. */
export function normalizeDatabaseBigintId(value) {
  const canonical = canonicalDatabaseBigintId(value);
  if (canonical === null) return null;
  return BigInt(canonical) <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(canonical) : canonical;
}

/** Exact positive integer for identities stored as PostgreSQL INTEGER. */
export function parseCanonicalDatabaseInt32Id(value) {
  const canonical = canonicalDatabaseBigintId(value);
  return canonical !== null && BigInt(canonical) <= MAX_DATABASE_INT32_ID ? Number(canonical) : null;
}
