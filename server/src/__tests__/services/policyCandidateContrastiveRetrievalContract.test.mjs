/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateContrastiveRetrievalContract,
} from '../../services/policyCandidateContrastiveRetrievalContract.mjs';

const libraries = [
  { id: 5, media_type: 'movie', is_active: true },
  { id: 6, media_type: 'movie', is_active: true },
  { id: 7, media_type: 'tv', is_active: true },
  { id: 8, media_type: 'movie', is_active: false },
];

describe('policyCandidateContrastiveRetrievalContract', () => {
  test('owns a bounded same-media candidate set and exact TMDb identity', () => {
    const contract = buildPolicyCandidateContrastiveRetrievalContract({
      policyResult: {
        action: 'prompt_confirm',
        ranked: [
          { library_id: 5 },
          { library_id: 6 },
          { library_id: 7 },
          { library_id: 8 },
        ],
      },
      libraries,
      metadata: { media_type: 'movie', tmdb_id: '44', title: 'Untrusted title' },
    });

    expect(contract).toEqual({
      version: 'policy.candidate_contrastive_retrieval_contract.v1',
      valid: true,
      statusId: 'ready',
      mediaType: 'movie',
      tmdbId: 44,
      candidates: [
        { libraryId: 5, mediaType: 'movie' },
        { libraryId: 6, mediaType: 'movie' },
      ],
    });
    expect(JSON.stringify(contract)).not.toContain('Untrusted title');
  });

  test('never falls back to title matching when the stable identity is absent', () => {
    const contract = buildPolicyCandidateContrastiveRetrievalContract({
      policyResult: { action: 'prompt_select', ranked: [{ library_id: 5 }, { library_id: 6 }] },
      libraries,
      metadata: { media_type: 'movie', title: 'Range of Stars' },
    });

    expect(contract).toEqual(expect.objectContaining({
      valid: false,
      statusId: 'identity_unverified',
      candidates: [],
    }));
  });

  test('does not query automatic or single-candidate policy outcomes', () => {
    const automatic = buildPolicyCandidateContrastiveRetrievalContract({
      policyResult: { action: 'auto_classify', ranked: [{ library_id: 5 }, { library_id: 6 }] },
      libraries,
      metadata: { media_type: 'movie', tmdb_id: 44 },
    });
    const singleCandidate = buildPolicyCandidateContrastiveRetrievalContract({
      policyResult: { action: 'prompt_confirm', ranked: [{ library_id: 5 }, { library_id: 7 }] },
      libraries,
      metadata: { media_type: 'movie', tmdb_id: 44 },
    });

    expect(automatic.statusId).toBe('not_pending_policy_decision');
    expect(singleCandidate.statusId).toBe('insufficient_candidates');
  });
});
