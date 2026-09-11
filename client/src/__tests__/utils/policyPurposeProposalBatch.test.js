/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  normalizePolicyPurposeProposalBatch,
} from '@/utils/policyPurposeProposalBatch'

const candidate = {
  policy: { id: 7, name: 'Animation policy' },
  library: { id: 17, name: 'Animation', mediaType: 'movie' },
  purposeProvenance: {
    id: 'profile_derived',
    declarationRequired: true,
    rawRuleProvenanceExposed: false,
  },
}

const batch = {
  version: 'policy_purpose_proposal_batch.v1',
  statusId: 'ready_for_apply',
  proposalFingerprint: `sha256:${'a'.repeat(64)}`,
  summary: { candidatePolicyCount: 1, exceptionPolicyCount: 0, reviewedPolicyCount: 1, truncated: false },
  candidates: [candidate],
  exceptions: [],
  action: { actionId: 'apply_reviewed_purpose_proposals', available: true, candidatePolicyIds: [7] },
  rawPurposeRulesExposed: false,
  policyStorageMutated: false,
  semanticSelectionAffected: false,
  routingAffected: false,
  providerAccessed: false,
}

describe('policyPurposeProposalBatch', () => {
  it('normalizes the closed proposal batch response', () => {
    expect(normalizePolicyPurposeProposalBatch(batch)).toEqual(batch)
  })

  it('rejects raw purpose terms, partial action lists, and automatic mutation claims', () => {
    expect(normalizePolicyPurposeProposalBatch({
      ...batch,
      candidates: [{ ...candidate, purposeRules: ['must-not-display'] }],
    })).toBeNull()
    expect(normalizePolicyPurposeProposalBatch({
      ...batch,
      action: { ...batch.action, candidatePolicyIds: [] },
    })).toBeNull()
    expect(normalizePolicyPurposeProposalBatch({
      ...batch,
      policyStorageMutated: true,
    })).toBeNull()
  })
})
