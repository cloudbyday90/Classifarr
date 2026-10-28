/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const prospectiveTimestamp = value => value instanceof Date ? value.getTime() :
  typeof value === 'string' ? Date.parse(value) : NaN;

/** PostgreSQL BIGINT identifiers stay exact across JSON and chronological tie-breaking. */
export function prospectiveClassificationId(value) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
  if (!['number', 'string'].includes(typeof value)) return null;
  const text = String(value);
  return /^[1-9][0-9]{0,18}$/.test(text) && BigInt(text) <= 9223372036854775807n ? text : null;
}
export function compareProspectiveClassificationIds(a, b) {
  const left = prospectiveClassificationId(a) ?? '', right = prospectiveClassificationId(b) ?? '';
  return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0);
}
