/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  normalizeHeldOutSemanticStudyReadiness,
} from '@/utils/heldOutSemanticStudyReadiness'

const safeFlags = {
  rawConfigurationExposed: false,
  libraryIdentityExposed: false,
  mediaIdentityExposed: false,
  semanticCohortReady: false,
  independentLabelsAvailable: false,
  semanticSelectionAffected: false,
  routingAffected: false,
}

describe('heldOutSemanticStudyReadiness', () => {
  it('accepts an aggregate-only availability report without granting study or routing authority', () => {
    expect(normalizeHeldOutSemanticStudyReadiness({
      version: 'policy.held_out_semantic_study_readiness.v2',
      statusId: 'eligibility_audit_available',
      normalLifecycleReceiptCount: 4,
      completePolicyEvidenceCount: 1,
      reAuditPreconditionSatisfied: true,
      ...safeFlags,
    })).toEqual(expect.objectContaining({
      statusId: 'eligibility_audit_available',
      reAuditPreconditionSatisfied: true,
      rawConfigurationExposed: false,
      semanticCohortReady: false,
      routingAffected: false,
    }))
  })

  it('fails closed for contradictory prerequisite, authority flags, or an extra projection', () => {
    expect(normalizeHeldOutSemanticStudyReadiness({
      version: 'policy.held_out_semantic_study_readiness.v2',
      statusId: 'eligibility_audit_available',
      normalLifecycleReceiptCount: 1,
      completePolicyEvidenceCount: 0,
      reAuditPreconditionSatisfied: true,
      ...safeFlags,
    })).toBeNull()

    expect(normalizeHeldOutSemanticStudyReadiness({
      version: 'policy.held_out_semantic_study_readiness.v2',
      statusId: 'normal_lifecycle_receipt_required',
      normalLifecycleReceiptCount: 0,
      completePolicyEvidenceCount: 0,
      reAuditPreconditionSatisfied: false,
      ...safeFlags,
      mediaIdentityExposed: true,
    })).toBeNull()

    expect(normalizeHeldOutSemanticStudyReadiness({
      version: 'policy.held_out_semantic_study_readiness.v2',
      statusId: 'normal_lifecycle_receipt_required',
      normalLifecycleReceiptCount: 0,
      completePolicyEvidenceCount: 0,
      reAuditPreconditionSatisfied: false,
      ...safeFlags,
      libraryName: 'must-not-project',
    })).toBeNull()
  })
})
