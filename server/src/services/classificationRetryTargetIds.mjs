/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';

export const MAX_RETRY_TARGET_ID = 2147483647;
export const RETRY_TARGET_ID_VALIDATION_MESSAGE =
  'classificationIds must contain positive integer numbers or canonical decimal strings from 1 to 2147483647';

/** Command admission only; decoded values must fit the existing retry INTEGER bound. */
export function parseRetryTargetId(value) {
  const canonical = canonicalDatabaseBigintId(value);
  if (canonical === null || BigInt(canonical) > BigInt(MAX_RETRY_TARGET_ID)) return null;
  return Number(canonical);
}
