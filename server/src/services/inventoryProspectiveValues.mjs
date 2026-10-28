/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId as prospectiveClassificationId } from './databaseIntegerValues.mjs';
export { prospectiveClassificationId };
export const prospectiveTimestamp = value => value instanceof Date ? value.getTime() :
  typeof value === 'string' ? Date.parse(value) : NaN;

/** PostgreSQL BIGINT identifiers stay exact across JSON and chronological tie-breaking. */
export function compareProspectiveClassificationIds(a, b) {
  const left = prospectiveClassificationId(a) ?? '', right = prospectiveClassificationId(b) ?? '';
  return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0);
}
