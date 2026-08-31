/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  normalizePolicyCandidateCorrectionPolicyChangeDecisionRecord,
} from '@/utils/policyCandidateCorrectionPolicyChangeDecisionRecordPresentation'

const HYPOTHESIS_ID = `pco_${'a'.repeat(32)}`

function response(overrides = {}) {
  return {
    version: 'policy.candidate_correction_policy_change_decision_record.v1',
    statusId: 'decision_recorded',
    reviewAvailable: true,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    observation: {
      hypothesisId: HYPOTHESIS_ID,
      outcomeAvailableAt: '2026-08-30T00:00:00.000Z',
      expiresAt: '2026-09-29T00:00:00.000Z',
    },
    decision: {
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_improved',
      revision: 1,
      createdAt: '2026-08-31T12:00:00.000Z',
      updatedAt: '2026-08-31T12:00:00.000Z',
      expiresAt: '2026-09-29T00:00:00.000Z',
    },
    ...overrides,
  }
}

describe('policy-change decision record presentation', () => {
  it('projects a fixed recorded decision and drops unknown fields', () => {
    const normalized = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecord(response({
      actorId: 7,
      policyId: 8,
    }))

    expect(normalized).toEqual(expect.objectContaining({
      statusId: 'decision_recorded',
      decision: expect.objectContaining({ revision: 1 }),
    }))
    expect(JSON.stringify(normalized)).not.toContain('actorId')
    expect(JSON.stringify(normalized)).not.toContain('policyId')
  })

  it('rejects an unknown decision ID or a decision outside the observation expiry', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeDecisionRecord(response({
      decision: { ...response().decision, decisionId: 'apply_policy' },
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionPolicyChangeDecisionRecord(response({
      decision: { ...response().decision, expiresAt: '2026-09-30T00:00:00.000Z' },
    }))).toBeNull()
  })

  it('accepts only the selector-free review-ready state without a decision', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeDecisionRecord(response({
      statusId: 'review_ready',
      decision: null,
    }))).toEqual(expect.objectContaining({ statusId: 'review_ready', decision: null }))
  })
})
