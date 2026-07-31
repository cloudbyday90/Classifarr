/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyCompatibilitySaveActionBoundary,
} from '@/utils/policyCompatibilitySaveActionBoundary'

describe('policyCompatibilitySaveActionBoundary', () => {
  it('enables an existing policy save from the direct library prerequisite only', () => {
    expect(buildPolicyCompatibilitySaveActionBoundary({
      form: { library_id: 1 },
      totalWeight: 0.85,
      compatibilityRoutingReadiness: { canRoute: false },
    })).toMatchObject({
      canSave: true,
      saveLabel: 'Save Policy',
      disabledReason: '',
    })
    expect(buildPolicyCompatibilitySaveActionBoundary({ form: { library_id: 1 } }))
      .not.toHaveProperty('status')
  })

  it('reports only a direct missing-library prerequisite', () => {
    expect(buildPolicyCompatibilitySaveActionBoundary({
      form: {},
    })).toMatchObject({
      canSave: false,
      disabledReason: 'Choose a destination library before saving.',
    })
  })
})
