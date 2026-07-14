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

  it('allows saving without a starter template because templates are optional accelerators', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      selectedPresets: [],
      totalWeight: 1,
    })

    expect(boundary).toMatchObject({
      canSave: true,
      status: 'ready',
      statusLabel: 'Ready to save',
      disabledReason: '',
    })
    expect(boundary.statusMessage).toContain('Starter templates are optional accelerators.')
  })

  it('requires weights to total 100 percent', () => {
    const boundary = buildPolicyBuilderSaveBoundary({
      form: { library_id: 1 },
      selectedPresets: [{ id: 1 }],
      totalWeight: 0.85,
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
      selectedPresets: [{ id: 1 }],
      totalWeight: 1,
      routingReadiness: {
        canRoute: false,
      },
    })

    expect(boundary).toMatchObject({
      canSave: true,
      status: 'ready_with_warning',
      tone: 'info',
      statusLabel: 'Ready to save; routing still needs setup',
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
