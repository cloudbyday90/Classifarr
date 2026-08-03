/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$/

export const NATIVE_POLICY_CREATE_IDEMPOTENCY_HEADER = 'Idempotency-Key'

export function isNativePolicyCreatePayload(payload) {
  return payload?.native_intent_establishment !== undefined
}

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

export function createNativePolicyCreateIdempotencyKey() {
  const randomUUID = globalThis.crypto?.randomUUID
  const idempotencyKey = typeof randomUUID === 'function'
    ? randomUUID.call(globalThis.crypto)
    : createUuidV4FromRandomValues()

  if (!idempotencyKey) {
    throw new Error('A secure browser random source is required to create a native policy.')
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new Error('The browser returned an invalid native policy create idempotency key.')
  }

  return idempotencyKey
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`
  }

  return JSON.stringify(value)
}

export function buildNativePolicyCreateAttemptFingerprint(payload) {
  if (!isNativePolicyCreatePayload(payload)) {
    throw new Error('A native policy create payload is required to build an idempotency fingerprint.')
  }

  return stableJson(payload)
}

export function buildNativePolicyCreateRequestOptions(idempotencyKey) {
  if (!IDEMPOTENCY_KEY_PATTERN.test(String(idempotencyKey || ''))) {
    throw new Error('A valid native policy create idempotency key is required.')
  }

  return {
    headers: {
      [NATIVE_POLICY_CREATE_IDEMPOTENCY_HEADER]: `"${idempotencyKey}"`,
    },
  }
}
