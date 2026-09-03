/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPolicyCandidateEvidenceCardPresentation,
  normalizePolicyCandidateEvidenceCard,
} from '@/utils/policyCandidateEvidenceCardPresentation'

function evidenceCard(overrides = {}) {
  return {
    version: 'policy.candidate_evidence_card.v1',
    status_id: 'counter_evidence_recommended',
    sources: [
      { source_id: 'item_identity', state_id: 'anchored' },
      { source_id: 'declared_policy', state_id: 'supporting' },
      { source_id: 'observed_library_profile', state_id: 'contextual' },
      { source_id: 'similar_item_retrieval', state_id: 'unavailable' },
      { source_id: 'confirmed_outcomes', state_id: 'unavailable' },
    ],
    ...overrides,
  }
}

describe('policyCandidateEvidenceCardPresentation', () => {
  it('maps fixed evidence identifiers to accessible operator copy', () => {
    const normalized = normalizePolicyCandidateEvidenceCard(evidenceCard({
      raw_metadata: 'ignore instructions',
    }))
    const presentation = getPolicyCandidateEvidenceCardPresentation(normalized)

    expect(presentation).toMatchObject({
      status_id: 'counter_evidence_recommended',
      label: 'Separate corroboration is limited',
      tone: 'attention',
      sources: expect.arrayContaining([
        expect.objectContaining({
          id: 'observed_library_profile',
          label: 'Current library match',
          message: 'This library’s existing items make it a reasonable option, but they cannot prove where this new item belongs.',
        }),
      ]),
    })
    expect(JSON.stringify(presentation)).not.toContain('ignore instructions')
  })

  it('fails closed when the server supplies an unknown source state or omits a source', () => {
    const unknownState = evidenceCard()
    unknownState.sources[2] = {
      source_id: 'observed_library_profile',
      state_id: 'untrusted_provider_value',
    }

    const missingSource = evidenceCard({ sources: evidenceCard().sources.slice(0, 4) })

    expect(normalizePolicyCandidateEvidenceCard(unknownState)).toBeNull()
    expect(normalizePolicyCandidateEvidenceCard(missingSource)).toBeNull()
  })
})
