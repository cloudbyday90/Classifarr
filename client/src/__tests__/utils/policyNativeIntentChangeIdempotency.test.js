/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildNativeIntentChangeRequestOptions,
  createNativeIntentChangeIdempotencyKey,
} from '@/utils/policyNativeIntentChangeIdempotency'

describe('policyNativeIntentChangeIdempotency', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a random browser key and sends it as a quoted Idempotency-Key header', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => '6fe3d170-9390-4ec5-95f7-42ad6f8ec777'),
    })

    const key = createNativeIntentChangeIdempotencyKey()

    expect(key).toBe('6fe3d170-9390-4ec5-95f7-42ad6f8ec777')
    expect(buildNativeIntentChangeRequestOptions(key)).toEqual({
      headers: { 'Idempotency-Key': `"${key}"` },
    })
  })

  it('rejects an invalid key instead of sending an ambiguous change attempt', () => {
    expect(() => buildNativeIntentChangeRequestOptions('not-valid')).toThrow(
      'valid native intent change idempotency key',
    )
  })
})
