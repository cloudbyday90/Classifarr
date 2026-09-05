/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const key = 'classifarr.mediaIdentity.pendingConfirmation.v1'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

export function validReviewInteger(value) {
  return Number.isInteger(value) && value > 0 && value <= 2147483647
}

export function recoveryReference(value) {
  if (value?.version !== 1 || !validReviewInteger(value.itemId) || typeof value.previewId !== 'string' || !uuid.test(value.previewId)) return null
  return { version: 1, itemId: value.itemId, previewId: value.previewId.toLowerCase() }
}

export function readRecoveryReference() {
  try {
    return recoveryReference(JSON.parse(sessionStorage.getItem(key)))
  } catch {
    return null
  }
}

export function storeRecoveryReference(reference) {
  const value = recoveryReference(reference)
  if (!value) return false
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function clearRecoveryReference(reference) {
  try {
    const stored = readRecoveryReference()
    if (stored?.itemId === reference?.itemId && stored?.previewId === reference?.previewId) sessionStorage.removeItem(key)
  } catch {
    // A retained reference can only cause another authenticated, read-only lookup.
  }
}
