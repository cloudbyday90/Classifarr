/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { canonicalDatabaseBigintId } from './databaseBigintId'

export { canonicalDatabaseBigintId as canonicalClassificationHistoryId }

export function normalizeClassificationHistoryId(value) {
  const text = canonicalDatabaseBigintId(value)
  if (text === null) return null
  return BigInt(text) <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(text) : text
}
