/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_LIBRARY_EVIDENCE_PROFILE_VERSION,
  buildPolicyLibraryEvidenceProfile,
} from '../../services/policyLibraryEvidenceProfile.mjs';

const candidateDestinations = [
  { library_id: 1, library_name: 'Movies', evidence_score: 80 },
  { library_id: 2, library_name: 'Comedy and Standup', evidence_score: 64 },
  { library_id: 3, library_name: 'Reality and Docuseries', evidence_score: 60 },
];

function candidate(libraryId, score, diagnostics = {}) {
  return {
    library_id: libraryId,
    score,
    policy_terms: ['Untrusted policy term'],
    candidate_diagnostics: diagnostics,
  };
}

describe('policyLibraryEvidenceProfile', () => {
  test('projects an allow-listed candidate comparison with score margins', () => {
    const profile = buildPolicyLibraryEvidenceProfile({
      classification: {
        tmdb_id: 42,
        media_type: 'movie',
        metadata: { overview: 'Untrusted media description' },
      },
      question: {
        meta: {
          candidates: candidateDestinations,
        },
      },
      candidateDestinations,
      sourceMetadata: {
        policyResult: {
          ranked: [
            candidate(1, 80, {
              identity_evidence: { status_id: 'positive_specialized_evidence' },
              positive_sources: { profile: true, rag: true, pattern: true },
              rag_evidence_quality: { matches: [{ title: 'Untrusted retrieved catalog title' }] },
            }),
            candidate(2, 64, {
              identity_evidence: { status_id: 'broad_compatibility_overlap' },
              positive_sources: { profile: true },
            }),
            candidate(3, 60, {
              native_intent_runtime: { eligible: true, rule_counts: { purpose: 1 } },
              profile_observed_absence_advisory: true,
            }),
          ],
        },
        api_key: 'must-not-be-projected',
      },
    });

    expect(profile).toEqual(expect.objectContaining({
      version: POLICY_LIBRARY_EVIDENCE_PROFILE_VERSION,
      candidates: [
        expect.objectContaining({
          rank: 1,
          library_id: 1,
          library_name: 'Movies',
          policy_score: 80,
          score_margin: 0,
        }),
        expect.objectContaining({
          rank: 2,
          library_id: 2,
          library_name: 'Comedy and Standup',
          policy_score: 64,
          score_margin: 16,
        }),
        expect.objectContaining({
          rank: 3,
          library_id: 3,
          library_name: 'Reality and Docuseries',
          policy_score: 60,
          score_margin: 20,
        }),
      ],
    }));
    expect(profile.candidates[0].evidence_card.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_id: 'item_identity', state_id: 'anchored' }),
      expect.objectContaining({ source_id: 'similar_item_retrieval', state_id: 'supporting' }),
    ]));

    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain('Untrusted policy term');
    expect(serialized).not.toContain('Untrusted media description');
    expect(serialized).not.toContain('Untrusted retrieved catalog title');
    expect(serialized).not.toContain('must-not-be-projected');
  });

  test('does not create a comparison without at least two scored destinations', () => {
    expect(buildPolicyLibraryEvidenceProfile({
      candidateDestinations: [{ library_id: 1, library_name: 'Movies', evidence_score: 80 }],
    })).toBeNull();

    expect(buildPolicyLibraryEvidenceProfile({
      candidateDestinations: candidateDestinations.map(({ library_id, library_name }) => ({
        library_id,
        library_name,
      })),
      sourceMetadata: {
        policyResult: {
          ranked: [{ library_id: 1, score: 80 }],
        },
      },
    })).toBeNull();
  });
});
