/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyCompatibilitySaveActionBoundary,
} from '@/utils/policyCompatibilitySaveActionBoundary'

describe('policyCompatibilitySaveActionBoundary', () => {
  it('keeps compatibility weight validation separate from native creation', () => {
    expect(buildPolicyCompatibilitySaveActionBoundary({
      form: { library_id: 1 },
      totalWeight: 0.85,
    })).toMatchObject({
      canSave: false,
      statusLabel: 'Adjust weights before saving',
    })
  })

  it('preserves the non-blocking compatibility routing warning', () => {
    expect(buildPolicyCompatibilitySaveActionBoundary({
      form: { library_id: 1 },
      totalWeight: 1,
      compatibilityRoutingReadiness: { canRoute: false },
    })).toMatchObject({
      canSave: true,
      status: 'ready_with_warning',
      statusLabel: 'Ready to save; routing still needs setup',
    })
  })
})
