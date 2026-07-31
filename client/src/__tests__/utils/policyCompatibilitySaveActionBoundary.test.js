/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyCompatibilitySaveActionBoundary,
} from '@/utils/policyCompatibilitySaveActionBoundary'

describe('policyCompatibilitySaveActionBoundary', () => {
  it('does not apply browser-owned weight validation to compatibility saves', () => {
    expect(buildPolicyCompatibilitySaveActionBoundary({
      form: { library_id: 1 },
      totalWeight: 0.85,
    })).toMatchObject({
      canSave: true,
      statusLabel: 'Ready to save',
    })
  })

  it('preserves the non-blocking compatibility routing warning', () => {
    expect(buildPolicyCompatibilitySaveActionBoundary({
      form: { library_id: 1 },
      compatibilityRoutingReadiness: { canRoute: false },
    })).toMatchObject({
      canSave: true,
      status: 'ready_with_warning',
      statusLabel: 'Ready to save; routing still needs setup',
    })
  })
})
