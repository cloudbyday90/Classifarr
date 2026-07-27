/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyNativeCreateActionBoundary,
} from '@/utils/policyNativeCreateActionBoundary'

describe('policyNativeCreateActionBoundary', () => {
  it('requires a library and declared purpose before enabling policy creation', () => {
    expect(buildPolicyNativeCreateActionBoundary()).toMatchObject({
      canSave: false,
      statusLabel: 'Choose a library before creating',
    })

    expect(buildPolicyNativeCreateActionBoundary({
      form: { library_id: 1 },
    })).toMatchObject({
      canSave: false,
      statusLabel: 'Choose destination meaning',
    })
  })

  it('keeps the native footer limited to client-owned draft readiness', () => {
    const boundary = buildPolicyNativeCreateActionBoundary({
      form: { library_id: 1 },
      nativeIntentEstablishment: {
        declared_intent: {
          purpose: [{ signal_type: 'genres' }],
        },
      },
    })

    expect(boundary).toEqual({
      canSave: true,
      saveLabel: 'Create Policy',
      deferLabel: 'Defer for now',
      status: 'ready',
      tone: 'success',
      statusLabel: 'Ready to create',
      statusMessage: 'Classifarr will validate and establish this destination policy on the server.',
      disabledReason: '',
    })
  })
})
