/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$/

export const NATIVE_INTENT_CHANGE_IDEMPOTENCY_HEADER = 'Idempotency-Key'

function createUuidV4FromRandomValues() {
  const getRandomValues = globalThis.crypto?.getRandomValues
  if (typeof getRandomValues !== 'function') return null

  const bytes = new Uint8Array(16)
  getRandomValues.call(globalThis.crypto, bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createNativeIntentChangeIdempotencyKey() {
  const randomUUID = globalThis.crypto?.randomUUID
  const idempotencyKey = typeof randomUUID === 'function'
    ? randomUUID.call(globalThis.crypto)
    : createUuidV4FromRandomValues()

  if (!idempotencyKey) {
    throw new Error('A secure browser random source is required to change native policy purpose.')
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new Error('The browser returned an invalid native intent change idempotency key.')
  }

  return idempotencyKey
}

export function buildNativeIntentChangeRequestOptions(idempotencyKey) {
  if (!IDEMPOTENCY_KEY_PATTERN.test(String(idempotencyKey || ''))) {
    throw new Error('A valid native intent change idempotency key is required.')
  }

  return {
    headers: {
      [NATIVE_INTENT_CHANGE_IDEMPOTENCY_HEADER]: `"${idempotencyKey}"`,
    },
  }
}
