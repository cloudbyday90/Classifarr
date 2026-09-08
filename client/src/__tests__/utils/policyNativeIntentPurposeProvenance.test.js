/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import {
  getNativeIntentPurposeProvenancePresentation,
  normalizeNativeIntentPurposeProvenance,
} from '@/utils/policyNativeIntentPurposeProvenance'

describe('policyNativeIntentPurposeProvenance', () => {
  it('keeps profile evidence descriptive and requires an explicit declaration', () => {
    const presentation = getNativeIntentPurposeProvenancePresentation({
      id: 'profile_derived',
      declarationRequired: true,
      rawRuleProvenanceExposed: false,
    })

    expect(presentation).toEqual(expect.objectContaining({
      declarationRequired: true,
      startLabel: 'Review and declare purpose',
      applyLabel: 'Declare reviewed purpose',
    }))
    expect(presentation.description).toContain('not declared purpose')
  })

  it('rejects unsafe raw provenance and inconsistent declaration state', () => {
    expect(normalizeNativeIntentPurposeProvenance({
      id: 'declared_native',
      declarationRequired: true,
      rawRuleProvenanceExposed: false,
    })).toBeNull()
    expect(normalizeNativeIntentPurposeProvenance({
      id: 'profile_derived',
      declarationRequired: true,
      rawRuleProvenanceExposed: true,
    })).toBeNull()
  })
})
