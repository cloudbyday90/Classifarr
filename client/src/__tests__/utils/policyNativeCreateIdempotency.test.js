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

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NATIVE_POLICY_CREATE_IDEMPOTENCY_HEADER,
  buildNativePolicyCreateAttemptFingerprint,
  buildNativePolicyCreateRequestOptions,
  createNativePolicyCreateIdempotencyKey,
  isNativePolicyCreatePayload,
} from '@/utils/policyNativeCreateIdempotency'

const IDEMPOTENCY_KEY = '6fe3d170-9390-4ec5-95f7-42ad6f8ec777'

describe('policyNativeCreateIdempotency', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses browser cryptography and a structured Idempotency-Key header', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => IDEMPOTENCY_KEY),
    })

    expect(createNativePolicyCreateIdempotencyKey()).toBe(IDEMPOTENCY_KEY)
    expect(buildNativePolicyCreateRequestOptions(IDEMPOTENCY_KEY)).toEqual({
      headers: {
        [NATIVE_POLICY_CREATE_IDEMPOTENCY_HEADER]: `"${IDEMPOTENCY_KEY}"`,
      },
    })
  })

  it('uses getRandomValues to create a UUIDv4 when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: values => {
        values.set(Array.from({ length: 16 }, (_, index) => index))
        return values
      },
    })

    expect(createNativePolicyCreateIdempotencyKey())
      .toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })

  it('keeps the same semantic native request fingerprint across key ordering changes', () => {
    const first = {
      name: 'Animation Policy',
      library_id: 4,
      native_intent_establishment: { declared_intent: { purpose: [] } },
    }
    const second = {
      native_intent_establishment: { declared_intent: { purpose: [] } },
      library_id: 4,
      name: 'Animation Policy',
    }

    expect(isNativePolicyCreatePayload(first)).toBe(true)
    expect(buildNativePolicyCreateAttemptFingerprint(first))
      .toBe(buildNativePolicyCreateAttemptFingerprint(second))
  })

  it('fails closed when a secure random source is unavailable', () => {
    vi.stubGlobal('crypto', undefined)

    expect(() => createNativePolicyCreateIdempotencyKey())
      .toThrow('secure browser random source')
  })
})
