/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  applySpecializedDestinationIdentityEvidence,
  SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS,
} from '../../services/policySpecializedDestinationIdentityEvidence.mjs';
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { projectRankedPolicyCandidates } from '../../services/policyCandidateRankingProjection.mjs';
import { projectPolicyCandidateDecision } from '../../services/policyCandidateDecisionProjection.mjs';
import { inferredPolicy, inferredRule } from '../fixtures/inferredPurposePolicyFixture.mjs';

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

function purpose(signalType, values, overrides = {}) {
  return [{ intent_role: 'purpose', signal_type: signalType, operator: 'require_any', values,
    semantics: 'identity', constraint_mode: 'advisory', source: 'native_intent',
    inference_state: 'inferred', ...overrides }];
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

  test.each(['genres', 'keywords', 'studios'])('%s requires a server-recorded declaration, including specific terms', signalType => {
    const term = signalType === 'genres' ? 'Mystery' : 'specific content term';
    const item = { media_type: 'movie', [signalType]: [term] };
    const provenanceCases = [
      { source: 'base', inference_state: 'inferred' },
      { source: 'media_server_library_profile', inference_state: 'inferred' },
      { source: 'unknown', inference_state: 'inferred' },
      { source: undefined, inference_state: 'inferred' },
      { source: 'media_server_library_profile', inference_state: 'partial' },
    ];

    for (const provenance of provenanceCases) {
      const evaluation = candidate(1, 80);
      const [result] = applySpecializedDestinationIdentityEvidence({
        item,
        policies: [nativePolicy(1, purpose(signalType, { require_any: [term] }, provenance))],
        evaluations: [evaluation],
      });

      expect(result.score).toBe(80);
      expect(result.candidate_diagnostics).toMatchObject({
        primary_viability: 'compatibility_only',
        primary_anchor_eligible: false,
        identity_evidence: { status_id: 'insufficient_specialized_evidence',
          matched_signal_count: 0, unique_signal_count: 0 },
      });
      expect(evaluation).toEqual(candidate(1, 80));
    }
  });

  test.each(['native_intent', 'operator_declared_intent'])('%s declarations can establish current content proof with inferred storage state', source => {
    const [result] = applySpecializedDestinationIdentityEvidence({
      item: { media_type: 'movie', production_companies: [{ name: 'Specific Studio' }] },
      policies: [nativePolicy(1, purpose('studios', { require_any: ['Specific Studio'] }, { source }))],
      evaluations: [candidate(1)],
    });

    expect(result.candidate_diagnostics.identity_evidence).toMatchObject({
      status_id: 'positive_specialized_evidence', unique_signal_count: 1, signal_types: ['studios'],
    });
  });

  test('mixed purpose counts only matching declared terms and leaves observed support available', () => {
    const declared = purpose('genres', { require_any: ['Mystery'] });
    const observed = inferredRule({ values: { require_any: ['Comedy'] } });
    const policy = nativePolicy(1, [...declared, observed]);
    const before = structuredClone(policy);
    const [observedOnly] = applySpecializedDestinationIdentityEvidence({
      item: { media_type: 'tv', genres: ['Comedy'] },
      policies: [policy], evaluations: [candidate(1)],
    });
    const [declaredMatch] = applySpecializedDestinationIdentityEvidence({
      item: { media_type: 'tv', genres: ['Comedy', 'Mystery'] },
      policies: [policy], evaluations: [candidate(1)],
    });

    expect(observedOnly.candidate_diagnostics.identity_evidence.status_id).toBe('insufficient_specialized_evidence');
    expect(declaredMatch.candidate_diagnostics.identity_evidence).toMatchObject({
      status_id: 'positive_specialized_evidence', matched_signal_count: 1, unique_signal_count: 1,
    });
    expect(policy).toEqual(before);
  });

  test('the Anime template keeps required candidate scope while its inferred rules cannot supply declared proof', () => {
    const policy = inferredPolicy({ library_name: 'Anime', library_media_type: 'tv' });
    policy.policy_intent_contract.purpose = [
      ...purpose('genres', { require_any: ['Animation'] }, { source: 'base' }),
      ...purpose('keywords', { require_any: ['anime'] }, { source: 'base' }),
    ];
    const matchingItem = { media_type: 'tv', genres: ['Animation'], keywords: ['anime'] };
    const matchingRuntime = evaluateNativePolicyIntent(policy, matchingItem);
    const nonmatchingRuntime = evaluateNativePolicyIntent(policy, {
      media_type: 'tv', genres: ['Drama'], keywords: ['workplace'],
    });
    const [result] = applySpecializedDestinationIdentityEvidence({
      item: matchingItem, policies: [policy],
      evaluations: [{ ...candidate(1, matchingRuntime.score), native_intent_runtime: matchingRuntime }],
    });

    expect(matchingRuntime).toMatchObject({ eligible: true, score: 80, purposeScore: 80 });
    expect(matchingRuntime.admissionBasis).toBeUndefined();
    expect(nonmatchingRuntime).toMatchObject({ eligible: false, score: 0, statusId: 'native_intent_runtime_purpose_not_matched' });
    expect(result.native_intent_runtime).toBe(matchingRuntime);
    expect(result.score).toBe(80);
    expect(result.candidate_diagnostics.identity_evidence.status_id).toBe('insufficient_specialized_evidence');
  });

  test('an Adults label does not turn matching profile observations into declared content proof', () => {
    const policy = inferredPolicy({ library_name: 'Adults' });
    const item = { media_type: 'movie', genres: ['Animation'], certification: 'R' };
    const runtime = evaluateNativePolicyIntent(policy, item);
    const [result] = applySpecializedDestinationIdentityEvidence({
      item, policies: [policy],
      evaluations: [{ ...candidate(1, runtime.score), library_name: 'Adults', native_intent_runtime: runtime }],
    });

    expect(runtime).toMatchObject({ eligible: true, score: 80, admissionBasis: 'inferred_profile_ranking' });
    expect(result.score).toBe(80);
    expect(result.candidate_diagnostics.identity_evidence.status_id).toBe('insufficient_specialized_evidence');
  });

  test('a synthetic scripted-comedy review calibrates migrated and observed purpose consistently before ranking', () => {
    const item = { media_type: 'tv', genres: ['Comedy', 'Drama'], certification: 'TV-MA' };
    const templatePolicy = nativePolicy(1, purpose('genres', { require_any: ['Comedy'] }, { source: 'base' }));
    const observedPolicy = nativePolicy(2, purpose('genres', { require_any: ['Comedy', 'Drama'] }, {
      source: 'media_server_library_profile',
    }));
    const evaluations = [
      { ...candidate(1, 58.5), library_name: 'Collection A', auto_classify_threshold: 85, prompt_threshold: 60 },
      { ...candidate(2, 80), library_name: 'Collection B', auto_classify_threshold: 85, prompt_threshold: 60 },
    ];
    const before = structuredClone({ templatePolicy, observedPolicy, evaluations });
    const rank = selectedPolicy => projectRankedPolicyCandidates(applySpecializedDestinationIdentityEvidence({
      item, policies: [selectedPolicy, observedPolicy], evaluations,
    }));

    const inferredRanked = rank(templatePolicy);
    expect(inferredRanked.map(result => [result.library_id, result.score])).toEqual([[2, 48], [1, 35.1]]);
    expect(inferredRanked.every(result => result.candidate_diagnostics.score_calibration.reason_code ===
      'insufficient_specialized_evidence')).toBe(true);
    expect(projectPolicyCandidateDecision({ ranked: inferredRanked })).toMatchObject({
      action: 'prompt_select', decisionDiagnostics: { requires_manual_review: true },
    });

    const declaredPolicy = nativePolicy(1, purpose('genres', { require_any: ['Comedy'] }));
    const declaredRanked = rank(declaredPolicy);
    expect(declaredRanked.map(result => [result.library_id, result.score])).toEqual([[1, 58.5], [2, 48]]);
    expect(declaredRanked[0].candidate_diagnostics.identity_evidence.status_id).toBe('positive_specialized_evidence');
    expect(projectPolicyCandidateDecision({ ranked: declaredRanked }).action).not.toBe('auto_classify');
    expect({ templatePolicy, observedPolicy, evaluations }).toEqual(before);
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
