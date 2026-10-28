/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Canonical positive PostgreSQL BIGINT, without rounding through a JavaScript number. */
export function canonicalDatabaseBigintId(value) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
  if (!['number', 'string'].includes(typeof value)) return null;
  const text = String(value);
  return /^[1-9][0-9]{0,18}$/.test(text) && BigInt(text) <= 9223372036854775807n ? text : null;
}
