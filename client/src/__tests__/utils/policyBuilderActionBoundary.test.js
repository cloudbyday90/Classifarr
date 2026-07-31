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
      selectedPresets: [{ id: 1 }],
    })

    expect(boundary).toMatchObject({
      canSave: false,
      status: 'blocked',
      statusLabel: 'Choose a library before creating',
      disabledReason: 'Choose a destination library before creating a policy.',
    })
  })

  it('requires declared native purpose before creating a policy', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      selectedPresets: [],
    })

    expect(boundary).toMatchObject({
      canSave: false,
      status: 'blocked',
      statusLabel: 'Choose destination meaning',
      disabledReason: 'Accept one or more observed values that should define this destination.',
    })
    expect(boundary.statusMessage).toContain('Accept at least one observed value')
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
      statusLabel: 'Ready to create',
    })
  })

  it('does not block compatibility saves on browser-owned scoring state', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      totalWeight: 0.85,
      hasExistingPolicy: true,
    })

    expect(boundary).toMatchObject({
      canSave: true,
      statusLabel: 'Ready to save',
    })
  })

  it('does not derive native creation readiness from local routing data', () => {
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
      status: 'ready',
      tone: 'success',
      statusLabel: 'Ready to create',
      disabledReason: '',
    })
  })

  it('marks the policy ready when save requirements and routing are ready', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      selectedPresets: [{ id: 1 }],
      hasExistingPolicy: true,
      compatibilityRoutingReadiness: {
        canRoute: true,
      },
    })

    expect(boundary).toMatchObject({
      canSave: true,
      saveLabel: 'Save Policy',
      status: 'ready',
      tone: 'success',
      statusLabel: 'Ready to save',
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
