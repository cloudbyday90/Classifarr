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

function currentCard(origin = 'declared_native') {
  const supports = ['declared_native', 'mixed'].includes(origin)
  const card = evidenceCard({ version: 'policy.candidate_evidence_card.v2', purpose_evidence: {
    version: 'policy.purpose_match_evidence.v1', origin, declaredMatch: supports ? 'matched' : 'no_declared_rules',
    runtimeEligible: true, specificity: supports ? 'positive_specialized_evidence' : 'insufficient_specialized_evidence',
  } })
  card.sources[1].state_id = supports ? 'supporting' : origin === 'unverified' ? 'unavailable' : 'contextual'
  return card
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

  it.each([['declared_native', 'Declared purpose'], ['profile_derived', 'Inferred purpose'],
    ['mixed', 'Mixed purpose origins'], ['unverified', 'Purpose origin unavailable']])('preserves v2 %s origin through raw and normalized paths', (origin, label) => {
    const card = currentCard(origin), normalized = normalizePolicyCandidateEvidenceCard(card)
    expect(normalized.version).toBe(card.version)
    expect(normalized.purpose_evidence.origin).toBe(origin)
    for (const input of [card, normalized]) {
      const purpose = getPolicyCandidateEvidenceCardPresentation(input).sources.find(source => source.id === 'declared_policy')
      expect(purpose.label).toBe(label)
    }
  })

  it('retains legacy version without inventing verified origin or declaration copy', () => {
    const card = normalizePolicyCandidateEvidenceCard(evidenceCard({ purpose_evidence: currentCard().purpose_evidence }))
    expect(card.version).toBe('policy.candidate_evidence_card.v1')
    expect(card.purpose_evidence).toBeUndefined()
    const purpose = getPolicyCandidateEvidenceCardPresentation(card).sources.find(source => source.id === 'declared_policy')
    expect(purpose.label).toBe('Legacy policy context')
    expect(purpose.message).toContain('does not establish declared purpose')
  })

  it('retains a visible constraint conflict alongside purpose origin', () => {
    const card = currentCard()
    card.status_id = 'evidence_conflict'
    card.sources[1].state_id = 'conflicting'
    const purpose = getPolicyCandidateEvidenceCardPresentation(card).sources.find(source => source.id === 'declared_policy')
    expect(purpose.label).toBe('Declared purpose')
    expect(purpose.message).toContain('A deterministic policy constraint conflicts')
  })

  it('does not invent declared or inferred constituents for a mixed unknown origin', () => {
    const card = currentCard('mixed')
    card.purpose_evidence.declaredMatch = 'no_declared_rules'
    card.purpose_evidence.specificity = 'insufficient_specialized_evidence'
    card.sources[1].state_id = 'contextual'
    const purpose = getPolicyCandidateEvidenceCardPresentation(card).sources.find(source => source.id === 'declared_policy')
    expect(purpose.message).toContain('Multiple purpose origins were retained')
    expect(purpose.message).not.toContain('Declared and inferred purpose coexist')
  })

  it.each(['missing', 'extra', 'match', 'state', 'version', 'duplicate'])('rejects %s proof even on normalized-looking input', kind => {
    const card = currentCard()
    if (kind === 'missing') delete card.purpose_evidence
    if (kind === 'extra') card.purpose_evidence.raw_rules = 'PRIVATE'
    if (kind === 'match') card.purpose_evidence.declaredMatch = 'anything'
    if (kind === 'state') card.purpose_evidence.origin = 'profile_derived'
    if (kind === 'version') card.version = 'policy.candidate_evidence_card.v3'
    if (kind === 'duplicate') card.sources.push(card.sources[0])
    expect(normalizePolicyCandidateEvidenceCard(card)).toBeNull()
    expect(getPolicyCandidateEvidenceCardPresentation(card)).toBeNull()
  })
})
