/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { parsePolicyPurposeHealth } from '@/utils/policyPurposeHealth'

const readyHealth = {
  version: 'policy_purpose_health.v1',
  statusId: 'ready',
  summary: {
    reviewedLibraryCount: 2,
    declaredPurposeLibraryCount: 2,
    missingPurposeLibraryCount: 0,
    competingDestinationLibraryCount: 0,
    profileDerivedPurposeLibraryCount: 0,
    unverifiedPurposeLibraryCount: 0,
    needsAttentionLibraryCount: 0,
    reviewWindowTruncated: false,
  },
  rawPurposeRulesExposed: false,
  libraryIdentityExposed: false,
  policyIdentityExposed: false,
  observedOutcomeDataExposed: false,
  semanticSelectionAffected: false,
  routingAffected: false,
}

describe('parsePolicyPurposeHealth', () => {
  it('accepts only the fixed safe aggregate response', () => {
    const parsed = parsePolicyPurposeHealth(readyHealth)

    expect(parsed).toEqual(readyHealth)
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.isFrozen(parsed.summary)).toBe(true)
  })

  it('rejects an expanded response and internally inconsistent status', () => {
    expect(parsePolicyPurposeHealth({ ...readyHealth, libraries: ['Movies'] })).toBeNull()
    expect(parsePolicyPurposeHealth({
      ...readyHealth,
      statusId: 'attention_required',
    })).toBeNull()
  })
})
