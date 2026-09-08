/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  normalizePolicyPurposeCoverageStudySourceReadiness,
} from '@/utils/policyPurposeCoverageStudySourceReadiness'

describe('policyPurposeCoverageStudySourceReadiness', () => {
  it('preserves only the fixed aggregate advisory status and bounded counts', () => {
    expect(normalizePolicyPurposeCoverageStudySourceReadiness({
      statusId: 'retained_declared_purpose_source_available',
      activePolicyCount: 3,
      profileOnlyPurposePolicyCount: 2,
      retainedPurposePolicyCount: 1,
      heldOutAuditCandidateSourceAvailable: true,
      semanticCohortReady: true,
      routingAffected: true,
    })).toEqual({
      statusId: 'retained_declared_purpose_source_available',
      activePolicyCount: 3,
      profileOnlyPurposePolicyCount: 2,
      retainedPurposePolicyCount: 1,
      heldOutAuditCandidateSourceAvailable: true,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    })
  })

  it('fails closed for an unknown status and inconsistent counts', () => {
    expect(normalizePolicyPurposeCoverageStudySourceReadiness({
      statusId: 'provider_supplied_status',
      activePolicyCount: 3,
    })).toBeNull()

    expect(normalizePolicyPurposeCoverageStudySourceReadiness({
      statusId: 'no_retained_declared_purpose_source',
      activePolicyCount: 2,
      profileOnlyPurposePolicyCount: 99,
      retainedPurposePolicyCount: 99,
      heldOutAuditCandidateSourceAvailable: true,
    })).toEqual(expect.objectContaining({
      activePolicyCount: 2,
      profileOnlyPurposePolicyCount: 2,
      retainedPurposePolicyCount: 0,
      heldOutAuditCandidateSourceAvailable: false,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    }))
  })
})
