/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  adaptPolicyAuthoringPreparedProposalPresentation,
  POLICY_AUTHORING_PROPOSAL_PRESENTATION_STATUS_IDS,
} from '@/utils/policyAuthoringProposalPresentation'

const library = { id: 7, name: 'Anime Movies', media_type: 'movie' }

function buildLifecycle() {
  return {
    version: 'policy.authoring_proposal.v1',
    statusId: 'eligible_to_prepare_proposal',
    library: { id: 7, name: 'Anime Movies', mediaType: 'movie' },
    action: { id: 'prepare_proposal', available: true },
    policy: null,
    proposal: { available: true, reasonId: 'current_profile_candidate_available' },
  }
}

function buildPreparedProposal(overrides = {}) {
  return {
    version: 'policy.authoring_proposal.v1',
    statusId: 'proposal_prepared',
    lifecycle: buildLifecycle(),
    proposal: {
      reference: 'proposal_reference_123456789012345678',
      revision: 'a'.repeat(64),
      expiresAt: '2026-08-03T12:00:00.000Z',
      summary: {
        title: 'Anime Movies Policy',
        purpose: [{ signalType: 'genres', operator: 'any_of', values: ['Animation'] }],
        helpfulHints: [{ signalType: 'genres', operator: 'any_of', values: ['Adventure'] }],
        hardLimitCount: 1,
        avoidCount: 0,
      },
    },
    ...overrides,
  }
}

describe('policyAuthoringProposalPresentation', () => {
  it('separates display-safe proposal content from opaque admission values', () => {
    const result = adaptPolicyAuthoringPreparedProposalPresentation({
      response: buildPreparedProposal(),
      expectedLibrary: library,
    })

    expect(result.ok).toBe(true)
    expect(result.presentation).toMatchObject({
      statusId: POLICY_AUTHORING_PROPOSAL_PRESENTATION_STATUS_IDS.READY,
      title: 'Anime Movies Policy',
      purpose: [{ signalType: 'genres', operator: 'any_of', values: ['Animation'] }],
      observedContext: {
        available: false,
        summary: 'Classifarr prepared this proposal from the current safe library profile.',
      },
    })
    expect(result.presentation).not.toHaveProperty('reference')
    expect(result.presentation).not.toHaveProperty('revision')
    expect(result.admission).toEqual({
      libraryId: 7,
      reference: 'proposal_reference_123456789012345678',
      revision: 'a'.repeat(64),
    })
    expect(Object.isFrozen(result.presentation)).toBe(true)
    expect(Object.isFrozen(result.admission)).toBe(true)
  })

  it.each([
    ['additional raw proposal field', response => { response.proposal.rawProfile = { private: true } }],
    ['unexpected summary field', response => { response.proposal.summary.profileItems = ['raw item'] }],
    ['mismatched lifecycle library', response => { response.lifecycle.library.id = 8 }],
    ['invalid opaque revision', response => { response.proposal.revision = 'browser-value' }],
  ])('fails closed for %s', (_label, mutate) => {
    const response = buildPreparedProposal()
    mutate(response)

    const result = adaptPolicyAuthoringPreparedProposalPresentation({
      response,
      expectedLibrary: library,
    })

    expect(result.ok).toBe(false)
    expect(result.presentation.statusId).toBe(
      POLICY_AUTHORING_PROPOSAL_PRESENTATION_STATUS_IDS.UNAVAILABLE
    )
    expect(result.admission).toBeNull()
  })
})
