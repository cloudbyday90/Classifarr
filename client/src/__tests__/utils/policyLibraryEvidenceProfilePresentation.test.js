/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  normalizePolicyLibraryEvidenceProfile,
} from '@/utils/policyLibraryEvidenceProfilePresentation'

function evidenceCard(states = {}) {
  return {
    version: 'policy.candidate_evidence_card.v1',
    status_id: 'corroborated',
    sources: [
      { source_id: 'item_identity', state_id: states.item_identity || 'anchored' },
      { source_id: 'declared_policy', state_id: states.declared_policy || 'supporting' },
      { source_id: 'observed_library_profile', state_id: states.observed_library_profile || 'contextual' },
      { source_id: 'similar_item_retrieval', state_id: states.similar_item_retrieval || 'supporting' },
      { source_id: 'confirmed_outcomes', state_id: states.confirmed_outcomes || 'supporting' },
    ],
  }
}

function profile(overrides = {}) {
  return {
    version: 'policy.library_evidence_profile.v1',
    candidates: [
      {
        rank: 1,
        library_id: 1,
        library_name: 'Movies',
        policy_score: 80,
        score_margin: 0,
        evidence_card: evidenceCard(),
      },
      {
        rank: 2,
        library_id: 2,
        library_name: 'Documentaries',
        policy_score: 64,
        score_margin: 16,
        evidence_card: evidenceCard({
          declared_policy: 'contextual',
          similar_item_retrieval: 'unavailable',
        }),
      },
    ],
    ...overrides,
  }
}

describe('policyLibraryEvidenceProfilePresentation', () => {
  it('keeps only the bounded candidate evidence comparison', () => {
    const normalized = normalizePolicyLibraryEvidenceProfile(profile({
      raw_provider_error: 'Do not display',
      candidates: profile().candidates.map((candidate) => ({
        ...candidate,
        raw_catalog_title: 'Do not display',
      })),
    }))

    expect(normalized).toEqual(expect.objectContaining({
      version: 'policy.library_evidence_profile.v1',
      candidates: [
        expect.objectContaining({ library_name: 'Movies', policy_score: 80, score_margin: 0 }),
        expect.objectContaining({ library_name: 'Documentaries', policy_score: 64, score_margin: 16 }),
      ],
    }))
    expect(JSON.stringify(normalized)).not.toContain('Do not display')
  })

  it('fails closed when a candidate margin does not match the leading score', () => {
    const invalid = profile()
    invalid.candidates[1].score_margin = 4

    expect(normalizePolicyLibraryEvidenceProfile(invalid)).toBeNull()
  })
})
