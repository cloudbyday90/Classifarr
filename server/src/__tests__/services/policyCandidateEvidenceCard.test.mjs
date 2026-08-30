/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateEvidenceCard,
  POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS,
  POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS,
  POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS,
} from '../../services/policyCandidateEvidenceCard.mjs';

function candidate(diagnostics = {}) {
  return { candidate_diagnostics: diagnostics };
}

function anchoredClassification() {
  return { media_type: 'movie', tmdb_id: 42 };
}

describe('policyCandidateEvidenceCard', () => {
  test('requests separate corroboration when profile context is the only support beyond declared policy', () => {
    const card = buildPolicyCandidateEvidenceCard({
      classification: anchoredClassification(),
      candidate: candidate({
        identity_evidence: { status_id: 'positive_specialized_evidence' },
        positive_sources: { profile: true },
      }),
    });

    expect(card.status_id).toBe(
      POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS.COUNTER_EVIDENCE_RECOMMENDED,
    );
    expect(card.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.ITEM_IDENTITY,
        state_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.ANCHORED,
      }),
      expect.objectContaining({
        source_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.DECLARED_POLICY,
        state_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING,
      }),
      expect.objectContaining({
        source_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.OBSERVED_LIBRARY_PROFILE,
        state_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.CONTEXTUAL,
      }),
    ]));
  });

  test('surfaces observed-history disagreement as a deterministic conflict even when retrieval supports the candidate', () => {
    const card = buildPolicyCandidateEvidenceCard({
      classification: anchoredClassification(),
      candidate: candidate({
        identity_evidence: { status_id: 'positive_specialized_evidence' },
        profile_observed_absence_advisory: true,
        positive_sources: { profile: true, rag: true },
        rag_evidence_quality: { matches: [{ title: 'must not be projected' }] },
      }),
    });

    expect(card.status_id).toBe(POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS.EVIDENCE_CONFLICT);
    expect(card.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.OBSERVED_LIBRARY_PROFILE,
        state_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.CONFLICTING,
      }),
      expect.objectContaining({
        source_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.SIMILAR_ITEM_RETRIEVAL,
        state_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING,
      }),
    ]));
    expect(JSON.stringify(card)).not.toContain('must not be projected');
  });

  test('does not present title similarity as an identity anchor without a stable metadata identifier', () => {
    const card = buildPolicyCandidateEvidenceCard({
      classification: { media_type: 'movie', title: 'Hurricane Katrina' },
      candidate: candidate({
        identity_evidence: { status_id: 'positive_specialized_evidence' },
      }),
      sourceMetadata: { title: 'Hurricane Katrina', overview: 'Untrusted metadata text' },
    });

    expect(card.status_id).toBe(
      POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS.IDENTITY_ANCHOR_INCOMPLETE,
    );
    expect(card.sources[0]).toEqual({
      source_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.ITEM_IDENTITY,
      state_id: POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.UNAVAILABLE,
    });
    expect(JSON.stringify(card)).not.toContain('Hurricane Katrina');
    expect(JSON.stringify(card)).not.toContain('Untrusted metadata text');
  });

  test('marks retained retrieval or outcome support as corroborated without returning source content', () => {
    const card = buildPolicyCandidateEvidenceCard({
      classification: anchoredClassification(),
      candidate: candidate({
        identity_evidence: { status_id: 'positive_specialized_evidence' },
        positive_sources: { rag: true, history: true },
      }),
    });

    expect(card.status_id).toBe(POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS.CORROBORATED);
    expect(card.sources).toHaveLength(5);
    expect(Object.isFrozen(card)).toBe(true);
    expect(Object.isFrozen(card.sources)).toBe(true);
  });
});
