/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  adaptPolicyAuthoringProposalAdmission,
  POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS,
} from '@/utils/policyAuthoringProposalAdmission'

function buildAdmission(overrides = {}) {
  return {
    version: 'policy.authoring_proposal.v1',
    statusId: 'proposal_admission_created',
    policy: { id: 19, libraryId: 7, name: 'Anime Movies Policy' },
    recovery: { lifecycleReloadRequired: false },
    ...overrides,
  }
}

describe('policyAuthoringProposalAdmission', () => {
  it('accepts a bounded created-policy admission response', () => {
    const result = adaptPolicyAuthoringProposalAdmission({
      response: buildAdmission(),
      expectedLibraryId: 7,
    })

    expect(result).toEqual({
      ok: true,
      result: {
        statusId: POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.CREATED,
        policy: { id: 19, libraryId: 7, name: 'Anime Movies Policy' },
        lifecycleReloadRequired: false,
      },
    })
  })

  it('accepts a non-success response only when it requires lifecycle recovery', () => {
    const result = adaptPolicyAuthoringProposalAdmission({
      response: buildAdmission({
        statusId: POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.PROPOSAL_STALE,
        policy: null,
        recovery: { lifecycleReloadRequired: true },
      }),
      expectedLibraryId: 7,
    })

    expect(result).toEqual({
      ok: true,
      result: {
        statusId: POLICY_AUTHORING_PROPOSAL_ADMISSION_STATUS_IDS.PROPOSAL_STALE,
        policy: null,
        lifecycleReloadRequired: true,
      },
    })
  })

  it.each([
    ['policy for another library', response => { response.policy.libraryId = 8 }],
    ['success recovery request', response => { response.recovery.lifecycleReloadRequired = true }],
    ['unexpected raw data', response => { response.rawDetails = { secret: true } }],
  ])('fails closed for %s', (_label, mutate) => {
    const response = buildAdmission()
    mutate(response)

    expect(adaptPolicyAuthoringProposalAdmission({
      response,
      expectedLibraryId: 7,
    })).toEqual({ ok: false, result: null })
  })
})
