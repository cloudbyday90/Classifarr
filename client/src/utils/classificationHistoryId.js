/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export function canonicalClassificationHistoryId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null
  if (!['number', 'string'].includes(typeof value)) return null
  const text = String(value)
  return /^[1-9][0-9]{0,18}$/.test(text) && BigInt(text) <= 9223372036854775807n ? text : null
}

export function normalizeClassificationHistoryId(value) {
  const text = canonicalClassificationHistoryId(value)
  if (text === null) return null
  return BigInt(text) <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(text) : text
}
