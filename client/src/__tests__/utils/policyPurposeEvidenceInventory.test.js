/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  normalizePolicyPurposeEvidenceInventory,
} from '@/utils/policyPurposeEvidenceInventory'

describe('policyPurposeEvidenceInventory', () => {
  it('accepts only bounded aggregate evidence that cannot affect semantic selection or routing', () => {
    expect(normalizePolicyPurposeEvidenceInventory({
      statusId: 'complete_policy_evidence_available',
      activePolicyCount: 4,
      authoritativeActiveNativePolicyCount: 4,
      currentIntentVersionPolicyCount: 4,
      currentIntentSchemaVersionPolicyCount: 4,
      retainedDeclaredPurposePolicyCount: 2,
      normalLifecycleReceiptPolicyCount: 3,
      verifiableLifecycleReceiptPolicyCount: 3,
      currentIntentLifecycleReceiptPolicyCount: 2,
      currentIntentRetainedPurposeLifecycleReceiptPolicyCount: 2,
      completePolicyEvidenceCount: 2,
      rawConfigurationExposed: false,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
      libraryName: 'must-not-project',
    })).toEqual(expect.objectContaining({
      statusId: 'complete_policy_evidence_available',
      completePolicyEvidenceCount: 2,
      incompletePolicyEvidenceCount: 2,
      completePolicyEvidenceAvailable: true,
      rawConfigurationExposed: false,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    }))
  })

  it('fails closed for unexpected authority flags or contradictory current-intent counts', () => {
    expect(normalizePolicyPurposeEvidenceInventory({
      statusId: 'complete_policy_evidence_available',
      activePolicyCount: 1,
      authoritativeActiveNativePolicyCount: 1,
      currentIntentVersionPolicyCount: 1,
      currentIntentSchemaVersionPolicyCount: 1,
      retainedDeclaredPurposePolicyCount: 1,
      normalLifecycleReceiptPolicyCount: 1,
      verifiableLifecycleReceiptPolicyCount: 1,
      currentIntentLifecycleReceiptPolicyCount: 0,
      completePolicyEvidenceCount: 1,
      rawConfigurationExposed: false,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    })).toBeNull()

    expect(normalizePolicyPurposeEvidenceInventory({
      statusId: 'policy_evidence_incomplete',
      rawConfigurationExposed: true,
    })).toBeNull()
  })
})
