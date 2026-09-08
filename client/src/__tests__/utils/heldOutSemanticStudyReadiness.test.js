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

const declaredPurposeRequired = {
  version: 'policy.held_out_semantic_study_readiness.v3',
  statusId: 'complete_declared_purpose_evidence_required',
  normalLifecycleReceiptCount: 1,
  completePolicyEvidenceCount: 0,
  currentCompleteAuditAvailable: false,
  measuredBlockerId: 'complete_declared_purpose_evidence_required',
  reAuditPreconditionSatisfied: false,
  ...safeFlags,
}

describe('heldOutSemanticStudyReadiness', () => {
  it('accepts an aggregate-only receipt with a current measured blocker without study authority', () => {
    expect(normalizeHeldOutSemanticStudyReadiness({
      version: 'policy.held_out_semantic_study_readiness.v3',
      statusId: 'eligibility_audit_available',
      normalLifecycleReceiptCount: 4,
      completePolicyEvidenceCount: 1,
      currentCompleteAuditAvailable: true,
      measuredBlockerId: 'await_balanced_eligible_cohort',
      reAuditPreconditionSatisfied: true,
      ...safeFlags,
    })).toEqual(expect.objectContaining({
      statusId: 'eligibility_audit_available',
      currentCompleteAuditAvailable: true,
      measuredBlockerId: 'await_balanced_eligible_cohort',
      rawConfigurationExposed: false,
      semanticCohortReady: false,
      routingAffected: false,
    }))
  })

  it('accepts a source blocker and rejects contradictory audit authority or an extra projection', () => {
    expect(normalizeHeldOutSemanticStudyReadiness(declaredPurposeRequired)).toEqual(
      expect.objectContaining({
        measuredBlockerId: 'complete_declared_purpose_evidence_required',
        currentCompleteAuditAvailable: false,
      }),
    )

    expect(normalizeHeldOutSemanticStudyReadiness({
      ...declaredPurposeRequired,
      currentCompleteAuditAvailable: true,
    })).toBeNull()

    expect(normalizeHeldOutSemanticStudyReadiness({
      ...declaredPurposeRequired,
      libraryName: 'must-not-project',
    })).toBeNull()
  })
})
