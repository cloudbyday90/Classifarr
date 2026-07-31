/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildPolicyBuilderSaveBoundary } from '@/utils/policyBuilderActionBoundary'

describe('policyBuilderActionBoundary', () => {
  it('requires a selected library before creating a native policy', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: {},
    })

    expect(boundary).toMatchObject({
      canSave: false,
      disabledReason: 'Choose a destination library before creating a policy.',
    })
  })

  it('requires declared native purpose before creating a policy', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
    })

    expect(boundary).toMatchObject({
      canSave: false,
      disabledReason: 'Accept one or more observed values that should define this destination.',
    })
  })

  it('does not apply compatibility state to native policy creation', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      nativeIntentEstablishment: {
        declared_intent: {
          purpose: [{ signal_type: 'genres' }],
        },
      },
    })

    expect(boundary).toMatchObject({
      canSave: true,
      saveLabel: 'Create Policy',
      disabledReason: '',
    })
  })

  it('does not block compatibility saves on browser-owned scoring or routing state', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      totalWeight: 0.85,
      hasExistingPolicy: true,
      compatibilityRoutingReadiness: { canRoute: false },
    })

    expect(boundary).toMatchObject({
      canSave: true,
      saveLabel: 'Save Policy',
      disabledReason: '',
    })
  })

  it('does not derive native creation state from local routing data', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      nativeIntentEstablishment: {
        declared_intent: {
          purpose: [{ signal_type: 'genres' }],
        },
      },
      compatibilityRoutingReadiness: {
        canRoute: false,
      },
    })

    expect(boundary).toMatchObject({
      canSave: true,
      disabledReason: '',
    })
  })

  it('enables an existing policy save from the selected library alone', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      hasExistingPolicy: true,
    })

    expect(boundary).toMatchObject({
      canSave: true,
      saveLabel: 'Save Policy',
      disabledReason: '',
    })
  })

  it('uses Save Policy for an existing policy without starter templates', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      selectedPresets: [],
      hasExistingPolicy: true,
    })

    expect(boundary.saveLabel).toBe('Save Policy')
  })
})
