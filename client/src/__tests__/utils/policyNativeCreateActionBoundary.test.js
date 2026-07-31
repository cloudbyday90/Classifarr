/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyNativeCreateActionBoundary,
} from '@/utils/policyNativeCreateActionBoundary'

describe('policyNativeCreateActionBoundary', () => {
  it('reports direct prerequisites before enabling policy creation', () => {
    expect(buildPolicyNativeCreateActionBoundary()).toMatchObject({
      canSave: false,
      disabledReason: 'Choose a destination library before creating a policy.',
    })

    expect(buildPolicyNativeCreateActionBoundary({
      form: { library_id: 1 },
    })).toMatchObject({
      canSave: false,
      disabledReason: 'Accept one or more observed values that should define this destination.',
    })
  })

  it('keeps the native footer limited to direct draft prerequisites', () => {
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
      disabledReason: '',
    })
  })
})
