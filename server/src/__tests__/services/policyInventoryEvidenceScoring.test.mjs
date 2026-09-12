/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { applyInventoryScoreEvidence } from '../../services/policyInventoryEvidenceScoring.mjs';
import { createPolicyInventoryEvidenceService } from '../../services/policyInventoryEvidenceService.mjs';
import { projectRankedPolicyCandidates } from '../../services/policyCandidateRankingProjection.mjs';
import { projectPolicyCandidateDecision } from '../../services/policyCandidateDecisionProjection.mjs';
import { evaluateItem } from '../../services/policyEngineEvaluation.mjs';
import { policyDecisionBuilder } from '../../services/policyDecisionBuilder.mjs';
import { consensusFixture } from '../fixtures/policyCandidateConsensusFixture.mjs';
import { consensusDependencies } from '../fixtures/policyCandidateConsensusFixture.mjs';
import { createPolicyCandidateConsensusService } from '../../services/policyCandidateConsensusService.mjs';
import { hasCandidateConsensusReceipt } from '../../services/policyCandidateConsensusReceipt.mjs';
import { buildPolicyCandidateAdjudicationContract } from '../../services/policyCandidateAdjudicationContract.mjs';
import { finalizePolicyCandidateAdjudication } from '../../services/policyCandidateAdjudicationResult.mjs';

function setup(score = 75) {
  const fixture = consensusFixture();
  const policies = fixture.libraries.map(library => ({ id: library.id, library_id: library.id,
    library_media_type: 'movie', enabled: true, trust_rag: true, rag_weight: .15 }));
  const evaluations = policies.map(policy => ({ policy_id: policy.id, library_id: policy.library_id,
    library_name: `Arbitrary ${policy.id}`, score: policy.id === 2 ? score : 70,
    auto_classify_threshold: 85, prompt_threshold: 60,
    candidate_diagnostics: { primary_viability: 'compatibility_only', evidence_class: 'broad_compatibility_overlap',
      primary_anchor_eligible: false, suppression_reasons: ['weak_primary_evidence', 'broad_compatibility_overlap'],
      drivers: ['profile_supported'] } }));
  const evidence = { statusId: 'available', candidates: fixture.evidence.candidates.map(candidate => ({
    ...candidate.descriptionEvidence, libraryId: candidate.libraryId })) };
  const retriever = { retrieve: jest.fn(async () => evidence) };
  return { policies, evaluations, evidence, retriever, item: fixture.metadata,
    service: createPolicyInventoryEvidenceService({ retriever }) };
}

test('retains 75 instead of discounting to 45; does not add a similarity/confidence boost', async () => {
  const input = setup();
  const before = structuredClone(input.evaluations);
  const baseline = projectRankedPolicyCandidates(input.evaluations);
  const scored = await input.service.apply(input);
  const ranked = projectRankedPolicyCandidates(scored);
  expect(baseline[0].score).toBe(45);
  expect(ranked[0]).toMatchObject({ library_id: 2, score: 75, raw_score: 75,
    candidate_diagnostics: { primary_viability: 'learned_inventory_support', primary_anchor_eligible: true,
      suppression_reasons: [], inventory_comparison: { compared_libraries: 3, neighbors: 3 } } });
  expect(projectPolicyCandidateDecision({ ranked })).toMatchObject({ action: 'prompt_confirm', decisionDiagnostics: null });
  expect(input.evaluations).toEqual(before);
  expect(scored[0]).toBe(input.evaluations[0]);
  expect(JSON.stringify(scored)).not.toContain('Example');
  expect(input.retriever.retrieve).toHaveBeenCalledTimes(1);
});

test('new automatic-band eligibility still requires local consensus, not a direct auto route', async () => {
  const input = setup(90);
  const ranked = projectRankedPolicyCandidates(await input.service.apply(input));
  expect(projectPolicyCandidateDecision({ ranked })).toMatchObject({ action: 'prompt_select',
    top: { score: 90, auto_classify_threshold: 85 }, decisionDiagnostics: null });
});

test('learned score reaches consensus only with unchanged policy evidence and a valid local proposal', async () => {
  const scoring = setup(90);
  const ranked = projectRankedPolicyCandidates(await scoring.service.apply(scoring));
  const input = consensusFixture();
  input.policyResult = policyDecisionBuilder.buildPolicyDecision(projectPolicyCandidateDecision({ ranked }));
  input.contract = buildPolicyCandidateAdjudicationContract({ policyResult: input.policyResult, libraries: input.libraries, mediaType: 'movie' });
  input.result = finalizePolicyCandidateAdjudication(input);
  expect(hasCandidateConsensusReceipt(input.result)).toBe(false);
  const service = createPolicyCandidateConsensusService(consensusDependencies(input));
  expect(hasCandidateConsensusReceipt(await service.resolve(input), { metadata: input.metadata })).toBe(true);
  const stale = createPolicyCandidateConsensusService({ ...consensusDependencies(input),
    readPolicy: async () => ({ ...input.policyResult, ranked: projectRankedPolicyCandidates(scoring.evaluations) }) });
  expect(await stale.resolve(input)).toBe(input.result);
});

test.each([
  ['disabled policy', i => { i.policies[1].enabled = false; }],
  ['RAG opt-out', i => { i.policies[1].trust_rag = false; }],
  ['RAG weight zero', i => { i.policies[1].rag_weight = 0; }],
  ['negative conflict', i => { i.evaluations[1].candidate_diagnostics.evidence_class = 'negative_conflict'; }],
  ['profile exclusion', i => { i.evaluations[1].candidate_diagnostics.profile_hard_excluded = true; }],
  ['native ineligible', i => { i.evaluations[1].native_intent_runtime = { eligible: false }; }],
  ['unknown suppression', i => { i.evaluations[1].candidate_diagnostics.suppression_reasons.push('operator_veto'); }],
  ['missing suppressions', i => { delete i.evaluations[1].candidate_diagnostics.suppression_reasons; }],
  ['non-finite score', i => { i.evaluations[1].score = NaN; }],
  ['invalid score', i => { i.evaluations[1].score = 96; }],
  ['cross-media policy', i => { i.policies[0].library_media_type = 'tv'; }],
  ['invalid library identity', i => { i.evaluations[0].library_id = 0; }],
  ['missing policy', i => { i.policies.pop(); }],
  ['wrong membership', i => { i.policies[0].library_id = 90; }],
  ['missing media type', i => { delete i.item.media_type; }],
  ['unavailable evidence', i => { i.evidence.statusId = 'unavailable'; }],
  ['partial evidence', i => { i.evidence.candidates[0].indexed = 3; }],
  ['missing candidate', i => { i.evidence.candidates.pop(); }],
  ['duplicate candidate', i => { i.evidence.candidates[0] = i.evidence.candidates[1]; }],
  ['foreign candidate', i => { i.evidence.candidates[0].libraryId = 99; }],
  ['all alternatives tie', i => { i.evidence.candidates[0].items = structuredClone(i.evidence.candidates[1].items); }],
  ['contradicting learned fit', i => { i.evidence.candidates[1].learnedProfile.relativeFit = -1; }],
  ['shared example', i => { i.evidence.candidates[1].items[0].sharedAcrossCandidates = true; }],
  ['duplicate normalized description', i => { i.evidence.candidates[1].items[1].description = ' Example 2-0 '; }],
  ['oversized description', i => { i.evidence.candidates[1].items[0].description = 'x'.repeat(2001); }],
])('preserves baseline on %s', async (_name, mutate) => {
  const input = setup();
  mutate(input);
  expect(await input.service.apply(input)).toEqual(input.evaluations);
});

test('retrieval errors remain private and preserve baseline', async () => {
  const input = setup();
  input.retriever.retrieve.mockRejectedValue(new Error('private endpoint'));
  expect(await input.service.apply(input)).toBe(input.evaluations);
});

test('does not fetch evidence when no weak candidate trusts RAG', async () => {
  const input = setup();
  input.policies.forEach(policy => { policy.trust_rag = false; });
  expect(await input.service.apply(input)).toBe(input.evaluations);
  expect(input.retriever.retrieve).not.toHaveBeenCalled();
});

test('compares every eligible library before any three-candidate cutoff', async () => {
  const input = setup();
  for (let id = 4; id <= 64; id++) {
    input.policies.push({ ...input.policies[0], id, library_id: id });
    input.evaluations.push({ ...input.evaluations[0], policy_id: id, library_id: id });
    input.evidence.candidates.push({ ...input.evidence.candidates[0], libraryId: id });
  }
  const result = await input.service.apply(input);
  expect(input.retriever.retrieve.mock.calls[0][0].contract.candidates).toHaveLength(64);
  expect(result[1].candidate_diagnostics.inventory_comparison.compared_libraries).toBe(64);
  input.evaluations.push({ ...input.evaluations[0], policy_id: 65, library_id: 65 });
  input.policies.push({ ...input.policies[0], id: 65, library_id: 65 });
  expect(await input.service.apply(input)).toBe(input.evaluations);
  expect(input.retriever.retrieve).toHaveBeenCalledTimes(1);
});

test('renaming libraries or changing their input order cannot change the winner', () => {
  const input = setup();
  const first = applyInventoryScoreEvidence(input).filter(candidate => candidate.candidate_diagnostics.inventory_comparison);
  input.evaluations.reverse().forEach(candidate => { candidate.library_name = 'Completely unrelated name'; });
  input.evidence.candidates.reverse();
  const second = applyInventoryScoreEvidence(input).filter(candidate => candidate.candidate_diagnostics.inventory_comparison);
  expect(first.map(candidate => candidate.library_id)).toEqual(second.map(candidate => candidate.library_id));
});

test('shared live evaluation invokes inventory scoring after eligibility and before calibration', async () => {
  const input = setup();
  const applyInventoryEvidence = jest.fn(options => input.service.apply(options));
  const result = await evaluateItem(input.item, { ragCache: { matches: [] } }, {
    checkAuthoritativeSignals: async () => null, getActivePolicies: async () => input.policies,
    evaluatePolicy: async policy => input.evaluations.find(candidate => candidate.policy_id === policy.id),
    applyInventoryEvidence,
    determineAction: ranked => policyDecisionBuilder.buildPolicyDecision(projectPolicyCandidateDecision({ ranked })),
  });
  expect(applyInventoryEvidence).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ action: 'prompt_confirm', confidence: 75, library: { library_id: 2 } });
});
