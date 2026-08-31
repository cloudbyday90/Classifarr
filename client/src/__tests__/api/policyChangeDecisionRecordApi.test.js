/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDataRequest = vi.fn()
const post = vi.fn()
const put = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest,
  apiClient: { post, put },
}))

const {
  createPolicyCandidateCorrectionPolicyChangeDecisionRecord,
  getPolicyCandidateCorrectionPolicyChangeDecisionRecord,
  revisePolicyCandidateCorrectionPolicyChangeDecisionRecord,
} = await import('../../api/policyChangeDecisionRecordApi')

describe('policy-change decision record API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses fixed endpoints and a narrow create/revision payload', () => {
    getPolicyCandidateCorrectionPolicyChangeDecisionRecord()
    createPolicyCandidateCorrectionPolicyChangeDecisionRecord({
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_improved',
    })
    revisePolicyCandidateCorrectionPolicyChangeDecisionRecord({
      decisionId: 'investigate_policy_evidence',
      rationaleId: 'outcome_unchanged_or_inconclusive',
      expectedRevision: 2,
    })

    expect(getDataRequest).toHaveBeenCalledWith(
      '/policies/candidate-correction/policy-change-decision-record'
    )
    expect(post).toHaveBeenCalledWith(
      '/policies/candidate-correction/policy-change-decision-record',
      { decision_id: 'retain_current_policy', rationale_id: 'outcome_improved' }
    )
    expect(put).toHaveBeenCalledWith(
      '/policies/candidate-correction/policy-change-decision-record',
      {
        decision_id: 'investigate_policy_evidence',
        rationale_id: 'outcome_unchanged_or_inconclusive',
        expected_revision: 2,
      }
    )
  })
})
