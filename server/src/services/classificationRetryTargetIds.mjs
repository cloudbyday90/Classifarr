/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId, MAX_DATABASE_BIGINT_ID } from './databaseIntegerValues.mjs';

export const RETRY_TARGET_ID_VALIDATION_MESSAGE =
  `classificationIds must contain positive safe integer numbers or canonical decimal strings from 1 to ${MAX_DATABASE_BIGINT_ID}`;

/** Keep legacy numeric batch IDs and preserve large History IDs as exact text. */
export function parseRetryTargetId(value) {
  const canonical = canonicalDatabaseBigintId(value);
  if (canonical === null) return null;
  return BigInt(canonical) <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(canonical) : canonical;
}
