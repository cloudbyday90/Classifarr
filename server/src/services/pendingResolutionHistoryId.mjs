/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeDatabaseBigintId } from './databaseIntegerValues.mjs';

/** Default pending-answer and cleanup admission requires a safe numeric History ID. */
export function parsePendingResolutionHistoryId(value) {
  const id = normalizeDatabaseBigintId(value);
  return typeof id === 'number' ? id : null;
}
