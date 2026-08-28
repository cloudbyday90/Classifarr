/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  adaptPolicyNativeIntentReconciliationPurposeSuggestion,
} from '@/utils/policyNativeIntentReconciliationPurposeSuggestionPresentation'

function buildSuggestion(overrides = {}) {
  return {
    version: 'native_intent_reconciliation_purpose_suggestion.v1',
    statusId: 'available',
    available: true,
    policy: { id: 17, name: 'Kids TV Policy' },
    library: { id: 18, name: 'Kids TV', mediaType: 'show' },
    profile: {
      itemCount: 44,
      generatedAt: '2026-08-28T15:00:00.000Z',
      genreSignalCount: 2,
    },
    suggestion: {
      sourceId: 'current_library_profile',
      rules: [{
        signalType: 'genres',
        operator: 'require_any',
        values: ['Animation', 'Family'],
        semantics: 'identity',
        constraintMode: 'advisory',
      }],
    },
    rawProfileExposed: false,
    persisted: false,
    routingAffected: false,
    learningAffected: false,
    aiInvoked: false,
    ...overrides,
  }
}

describe('policyNativeIntentReconciliationPurposeSuggestionPresentation', () => {
  it('accepts only the bounded current-profile suggestion for its requested policy', () => {
    const result = adaptPolicyNativeIntentReconciliationPurposeSuggestion({
      suggestion: buildSuggestion(),
      expectedPolicyId: 17,
    })

    expect(result).toEqual({
      ok: true,
      presentation: expect.objectContaining({
        available: true,
        policy: { id: 17, name: 'Kids TV Policy' },
        suggestion: expect.objectContaining({
          rules: [expect.objectContaining({ values: ['Animation', 'Family'] })],
        }),
      }),
    })
  })

  it.each([
    ['a mismatched policy', { policy: { id: 19, name: 'Other Policy' } }],
    ['a persistence claim', { persisted: true }],
    ['a routing claim', { routingAffected: true }],
    ['an unsupported rule', { suggestion: { sourceId: 'current_library_profile', rules: [{ signalType: 'studios' }] } }],
  ])('fails closed for %s', (_name, overrides) => {
    const result = adaptPolicyNativeIntentReconciliationPurposeSuggestion({
      suggestion: buildSuggestion(overrides),
      expectedPolicyId: 17,
    })

    expect(result).toEqual({
      ok: false,
      presentation: {
        statusId: 'unavailable',
        available: false,
        policy: null,
        library: null,
        profile: null,
        suggestion: null,
      },
    })
  })

  it('keeps an unavailable server state non-actionable', () => {
    const result = adaptPolicyNativeIntentReconciliationPurposeSuggestion({
      suggestion: buildSuggestion({
        statusId: 'profile_stale',
        available: false,
        suggestion: null,
      }),
      expectedPolicyId: 17,
    })

    expect(result).toEqual({
      ok: true,
      presentation: {
        statusId: 'profile_stale',
        available: false,
        policy: null,
        library: null,
        profile: null,
        suggestion: null,
      },
    })
  })
})
