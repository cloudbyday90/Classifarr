/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const NATIVE_POLICY_CREATE_REQUEST_FIELDS = Object.freeze([
  'library_id',
  'name',
  'native_intent_establishment',
])

function normalizePositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function buildPolicyName(formValue = {}, currentLibrary = null) {
  const explicitName = String(formValue?.name || '').trim()
  if (explicitName) return explicitName

  const libraryName = String(currentLibrary?.name || '').trim()
  return libraryName ? `${libraryName} Policy` : ''
}

export function buildNativePolicyCreatePayload({
  formValue = {},
  currentLibrary = null,
  nativeIntentEstablishment = null,
} = {}) {
  const libraryId = normalizePositiveInteger(formValue?.library_id)
  const name = buildPolicyName(formValue, currentLibrary)

  if (libraryId === null || !name || !nativeIntentEstablishment) {
    return null
  }

  return {
    library_id: libraryId,
    name,
    native_intent_establishment: nativeIntentEstablishment,
  }
}
