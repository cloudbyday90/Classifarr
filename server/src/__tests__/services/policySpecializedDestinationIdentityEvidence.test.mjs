/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  applySpecializedDestinationIdentityEvidence,
  SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS,
} from '../../services/policySpecializedDestinationIdentityEvidence.mjs';

function nativePolicy(id, purpose) {
  return {
    id,
    policy_runtime_authority: {
      sourceId: 'native_intent',
      validationOk: true,
    },
    policy_intent_contract: {
      source: 'native_intent',
      validation: { valid: true },
      purpose,
    },
  };
}

function candidate(policyId, score = 80) {
  return {
    policy_id: policyId,
    library_id: policyId,
    score,
    candidate_diagnostics: {
      primary_viability: 'identity_evidence',
      evidence_class: 'identity',
      primary_anchor_eligible: true,
      suppression_reasons: [],
    },
  };
}

function purpose(signalType, values) {
  return [{ signal_type: signalType, values }];
}

describe('policySpecializedDestinationIdentityEvidence', () => {
  test('retains a candidate-specific current required genre as specialized identity evidence', () => {
    const result = applySpecializedDestinationIdentityEvidence({
      item: { media_type: 'tv', genres: ['Mystery', 'Drama'] },
      policies: [
        nativePolicy(1, purpose('genres', { require_any: ['Drama', 'Mystery'] })),
        nativePolicy(2, purpose('genres', { require_any: ['Drama'] })),
      ],
      evaluations: [candidate(1), candidate(2)],
    });

    expect(result[0].candidate_diagnostics).toEqual(expect.objectContaining({
      primary_viability: 'identity_evidence',
      evidence_class: 'specialized_identity',
      primary_anchor_eligible: true,
      identity_evidence: expect.objectContaining({
        status_id: SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.POSITIVE_SPECIALIZED_EVIDENCE,
        matched_signal_count: 2,
        unique_signal_count: 1,
        shared_signal_count: 1,
        signal_types: ['genres'],
      }),
    }));
    expect(result[1].candidate_diagnostics).toEqual(expect.objectContaining({
      primary_viability: 'compatibility_only',
      evidence_class: 'broad_compatibility_overlap',
      primary_anchor_eligible: false,
      suppression_reasons: expect.arrayContaining([
        'broad_compatibility_overlap',
        'weak_primary_evidence',
      ]),
    }));
  });

  test('downgrades a genuine shared genre overlap instead of selecting a broad candidate', () => {
    const result = applySpecializedDestinationIdentityEvidence({
      item: { media_type: 'movie', genres: ['Drama'] },
      policies: [
        nativePolicy(1, purpose('genres', { require_any: ['Drama', 'Reality'] })),
        nativePolicy(2, purpose('genres', { require_any: ['Drama', 'Comedy'] })),
      ],
      evaluations: [candidate(1, 90), candidate(2, 80)],
    });

    expect(result.map((entry) => entry.candidate_diagnostics.identity_evidence.status_id)).toEqual([
      SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.BROAD_COMPATIBILITY_OVERLAP,
      SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.BROAD_COMPATIBILITY_OVERLAP,
    ]);
    expect(result.map((entry) => entry.candidate_diagnostics.primary_viability)).toEqual([
      'compatibility_only',
      'compatibility_only',
    ]);
  });

  test('does not treat inferred profile genres as specialized identity evidence', () => {
    const inferredProfilePurpose = [{
      signal_type: 'genres',
      values: {
        require_any: ['Comedy', 'Documentary', 'TV Movie', 'Biography', 'Drama'],
      },
      source: 'media_server_library_profile',
      inference_state: 'inferred',
    }];

    const [result] = applySpecializedDestinationIdentityEvidence({
      item: {
        media_type: 'movie',
        genres: ['Adventure', 'Action', 'Documentary', 'Drama'],
      },
      policies: [nativePolicy(1, inferredProfilePurpose)],
      evaluations: [candidate(1, 62.13)],
    });

    expect(result.candidate_diagnostics).toEqual(expect.objectContaining({
      primary_viability: 'compatibility_only',
      evidence_class: 'insufficient_specialized_evidence',
      primary_anchor_eligible: false,
      suppression_reasons: expect.arrayContaining([
        'insufficient_specialized_evidence',
        'weak_primary_evidence',
      ]),
      identity_evidence: expect.objectContaining({
        status_id: SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS
          .INSUFFICIENT_SPECIALIZED_EVIDENCE,
        matched_signal_count: 0,
        unique_signal_count: 0,
      }),
    }));
  });

  test('does not allow media type or preferences to establish specialized identity', () => {
    const result = applySpecializedDestinationIdentityEvidence({
      item: { media_type: 'tv', genres: ['Drama'] },
      policies: [
        nativePolicy(1, purpose('media_type', { include: ['tv'], semantics: 'identity' })),
        nativePolicy(2, purpose('genres', { prefer: ['Drama'] })),
      ],
      evaluations: [candidate(1), candidate(2)],
    });

    expect(result.map((entry) => entry.candidate_diagnostics.identity_evidence.status_id)).toEqual([
      SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.INSUFFICIENT_SPECIALIZED_EVIDENCE,
      SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.INSUFFICIENT_SPECIALIZED_EVIDENCE,
    ]);
    expect(result.map((entry) => entry.candidate_diagnostics.primary_anchor_eligible)).toEqual([false, false]);
  });

  test('leaves non-native candidates outside the taxonomy and does not retain matched terms', () => {
    const result = applySpecializedDestinationIdentityEvidence({
      item: { media_type: 'movie', genres: ['Drama'] },
      policies: [{ id: 1 }],
      evaluations: [candidate(1)],
    });

    expect(result[0].candidate_diagnostics.identity_evidence).toEqual({
      schema_version: 1,
      status_id: SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.NOT_APPLICABLE,
      current_evaluation: true,
      contract_validated: false,
      considered_candidate_count: 1,
      matched_signal_count: 0,
      unique_signal_count: 0,
      shared_signal_count: 0,
      signal_types: [],
    });
    expect(JSON.stringify(result)).not.toContain('Drama');
  });

  test('uses keyword evidence only when a required declared term currently matches', () => {
    const result = applySpecializedDestinationIdentityEvidence({
      item: {
        media_type: 'movie',
        title: 'Late Night Special',
        keywords: ['stand-up'],
      },
      policies: [
        nativePolicy(1, purpose('keywords', { require_any: ['stand-up'] })),
        nativePolicy(2, purpose('keywords', { require_any: ['drama'] })),
      ],
      evaluations: [candidate(1), candidate(2)],
    });

    expect(result[0].candidate_diagnostics.identity_evidence).toEqual(expect.objectContaining({
      status_id: SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.POSITIVE_SPECIALIZED_EVIDENCE,
      signal_types: ['keywords'],
    }));
    expect(result[1].candidate_diagnostics.identity_evidence.status_id)
      .toBe(SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.INSUFFICIENT_SPECIALIZED_EVIDENCE);
  });

  test('does not revive an existing hard conflict with specialized evidence', () => {
    const conflictingCandidate = {
      ...candidate(1),
      candidate_diagnostics: {
        primary_viability: 'identity_evidence',
        evidence_class: 'negative_conflict',
        primary_anchor_eligible: false,
        profile_hard_excluded: true,
      },
    };
    const [result] = applySpecializedDestinationIdentityEvidence({
      item: { media_type: 'movie', genres: ['Mystery'] },
      policies: [nativePolicy(1, purpose('genres', { require_any: ['Mystery'] }))],
      evaluations: [conflictingCandidate],
    });

    expect(result.candidate_diagnostics).toEqual(expect.objectContaining({
      evidence_class: 'negative_conflict',
      primary_anchor_eligible: false,
      profile_hard_excluded: true,
      identity_evidence: expect.objectContaining({
        status_id: SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.POSITIVE_SPECIALIZED_EVIDENCE,
      }),
    }));
  });
});
