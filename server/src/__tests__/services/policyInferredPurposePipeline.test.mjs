/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { inferredPolicy, inferredRule } from '../fixtures/inferredPurposePolicyFixture.mjs';
import { evaluateItem, evaluatePolicy } from '../../services/policyEngineEvaluation.mjs';
import { createPolicyInventoryEvidenceService } from '../../services/policyInventoryEvidenceService.mjs';
import { projectRankedPolicyCandidates } from '../../services/policyCandidateRankingProjection.mjs';
import { projectPolicyCandidateDecision } from '../../services/policyCandidateDecisionProjection.mjs';
import { policyDecisionBuilder } from '../../services/policyDecisionBuilder.mjs';
import { buildPolicyCandidateAdjudicationPool, buildPolicyCandidateAdjudicationContract } from '../../services/policyCandidateAdjudicationContract.mjs';
import { rankLearnedCandidateShortlist } from '../../services/learnedCandidateShortlistRanking.mjs';
import { resolveDeterministicOutcomeAiMode } from '../../services/classificationDeterministicAiMode.mjs';

async function replay({ policies, metadata = { media_type: 'movie', genres: ['Fantasy'] }, profileScore = 0, absence = false }) {
  const retrieve = jest.fn(async ({ contract }) => ({ statusId: 'unavailable', candidates: contract.candidates }));
  const inventory = createPolicyInventoryEvidenceService({ retriever: { retrieve } });
  const profile = jest.fn(async () => ({ score: profileScore,
    diagnostics: { exclusions: { genres: absence ? ['Fantasy'] : [] } } }));
  const result = await evaluateItem(metadata, { ragCache: { matches: [] } }, {
    checkAuthoritativeSignals: async () => null, getActivePolicies: async () => policies,
    evaluatePolicy: (policy, item, cache, related) => evaluatePolicy(policy, item, cache, related, {
      scoreProfileWithDiagnostics: profile, scoreRAG: async () => 0 }),
    applyInventoryEvidence: input => inventory.apply(input), rankResults: projectRankedPolicyCandidates,
    determineAction: ranked => policyDecisionBuilder.buildPolicyDecision(projectPolicyCandidateDecision({ ranked })),
  });
  const libraries = policies.map(policy => ({ id: policy.library_id, name: policy.library_name,
    media_type: policy.library_media_type, is_active: true }));
  return { result, retrieve, profile, libraries, pool: buildPolicyCandidateAdjudicationPool({ policyResult: result, libraries, mediaType: metadata.media_type }) };
}

test('non-top/missing genres reach full-pool retrieval and advisory AI without score inflation', async () => {
  for (const genres of [undefined, ['Fantasy']]) {
    const policies = [inferredPolicy(), inferredPolicy({ id: 2, library_id: 2 })];
    const { result, retrieve, pool } = await replay({ policies, metadata: { media_type: 'movie', genres } });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(retrieve.mock.calls[0][0].contract.candidates.map(row => row.libraryId)).toEqual([1, 2]);
    expect(result.ranked.map(row => row.score)).toEqual([0, 0]);
    expect(pool.map(row => row.libraryId)).toEqual([1, 2]);
    expect(pool.every(row => row.policyScore === 0)).toBe(true);
    expect(result.action).toBe('manual');
  }
});

test('profile absence does not become an inferred eligibility veto', async () => {
  const { result, pool } = await replay({ policies: [inferredPolicy(), inferredPolicy({ id: 2, library_id: 2 })], absence: true });
  expect(pool).toHaveLength(2);
  expect(result.ranked.every(row => row.candidate_diagnostics.profile_observed_absence_advisory &&
    !row.candidate_diagnostics.profile_hard_excluded)).toBe(true);
});

test('explicit requirements, hard limits, failed authority and other media cannot re-enter through retrieval', async () => {
  const policies = Array.from({ length: 6 }, (_, id) => inferredPolicy({ id: id + 1, library_id: id + 1 }));
  policies[2].policy_intent_contract.purpose.push(inferredRule({ source: 'operator_declared' }));
  policies[3].policy_intent_contract.hard_limits = [{ signal_type: 'language', constraint_mode: 'strict', values: { require_any: ['ja'] } }];
  policies[4].policy_runtime_authority.validationOk = false;
  policies[5].library_media_type = 'tv';
  const { result, profile, retrieve, pool } = await replay({ policies });
  expect(profile).toHaveBeenCalledTimes(2);
  expect(result.ranked.map(row => row.library_id)).toEqual([1, 2]);
  expect(pool.map(row => row.libraryId)).toEqual([1, 2]);
  expect(retrieve.mock.calls[0][0].contract.candidates.map(row => row.libraryId)).toEqual([1, 2]);
});

test('no RAG opt-in means no inventory retrieval; a positive profile remains only ranking evidence', async () => {
  const policies = [inferredPolicy({ trust_rag: false }), inferredPolicy({ id: 2, library_id: 2, trust_rag: false })];
  const { retrieve, result } = await replay({ policies, profileScore: 90 });
  expect(retrieve).not.toHaveBeenCalled();
  expect(result.action).not.toBe('auto_classify');
  expect(result.ranked.every(row => row.score < 90)).toBe(true);
});

test('zero-score admission cannot authorize routing even when configured thresholds are zero', async () => {
  const { result } = await replay({ policies: [inferredPolicy({ auto_classify_threshold: 0, prompt_threshold: 0 })] });
  expect(result.ranked[0].score).toBe(0);
  expect(result.action).toBe('manual');
});

test('description support can bring a non-top-genre library into the bounded AI shortlist', async () => {
  const policies = Array.from({ length: 5 }, (_, index) => inferredPolicy({ id: index + 1, library_id: index + 1,
    library_name: `Arbitrary label ${index}` }));
  const { result, libraries, pool } = await replay({ policies });
  const descriptions = pool.map(({ libraryId }) => ({ libraryId, eligible: 20, indexed: 20,
    items: [1, 2, 3].map(index => ({ description: `Synthetic synopsis ${libraryId}:${index}`,
      similarity: libraryId === 5 ? .9 : .6, sharedAcrossCandidates: false })) }));
  const order = rankLearnedCandidateShortlist(pool, new Map(), descriptions);
  const contract = buildPolicyCandidateAdjudicationContract({ policyResult: result, libraries, mediaType: 'movie', candidateOrder: order });
  expect(contract.valid).toBe(true);
  expect(contract.candidates.map(row => row.libraryId)).toEqual([1, 2, 5]);
  expect(contract.candidates[2].policyScore).toBe(0);
  expect(result.action).toBe('manual');
  expect(resolveDeterministicOutcomeAiMode({ policyResult: result, libraries,
    candidateAdjudication: contract })).toMatchObject({ shouldInvoke: true, mode: 'adjudicate' });
});
