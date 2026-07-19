/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildPolicyBuilderSaveBoundary } from '@/utils/policyBuilderActionBoundary'

describe('policyBuilderActionBoundary', () => {
  it('requires a selected library before saving', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: {},
      selectedPresets: [{ id: 1 }],
      totalWeight: 1,
    })

    expect(boundary).toMatchObject({
      canSave: false,
      status: 'blocked',
      statusLabel: 'Choose a library before saving',
      disabledReason: 'Choose a destination library before saving.',
    })
  })

  it('requires declared native purpose before creating a policy', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      selectedPresets: [],
      totalWeight: 1,
    })

    expect(boundary).toMatchObject({
      canSave: false,
      status: 'blocked',
      statusLabel: 'Choose destination meaning',
      disabledReason: 'Accept one or more observed values that should define this destination.',
    })
    expect(boundary.statusMessage).toContain('Accept at least one observed value')
  })

  it('does not apply legacy scoring-weight validation to native policy creation', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      totalWeight: 0.85,
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

  it('requires weights to total 100 percent when editing a compatibility policy', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      totalWeight: 0.85,
      hasExistingPolicy: true,
    })

    expect(boundary).toMatchObject({
      canSave: false,
      statusLabel: 'Adjust weights before saving',
    })
    expect(boundary.statusMessage).toContain('85%')
  })

  it('allows save with a non-blocking routing warning', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      totalWeight: 1,
      nativeIntentEstablishment: {
        declared_intent: {
          purpose: [{ signal_type: 'genres' }],
        },
      },
      routingReadiness: {
        canRoute: false,
      },
    })

    expect(boundary).toMatchObject({
      canSave: true,
      status: 'ready_with_warning',
      tone: 'info',
      statusLabel: 'Ready to create; routing still needs setup',
      disabledReason: '',
    })
  })

  it('marks the policy ready when save requirements and routing are ready', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      selectedPresets: [{ id: 1 }],
      totalWeight: 1,
      hasExistingPolicy: true,
      routingReadiness: {
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
      totalWeight: 1,
      hasExistingPolicy: true,
    })

    expect(boundary.saveLabel).toBe('Save Policy')
  })
})
