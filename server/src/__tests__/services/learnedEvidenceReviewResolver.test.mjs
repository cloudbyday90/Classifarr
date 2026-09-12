/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { assessLearnedEvidenceReview } from '../../services/learnedEvidenceReviewResolver.mjs';
import { inspectLearnedEvidenceReviewScope } from '../../services/learnedEvidenceReviewScope.mjs';
import { assessPolicyCandidateConsensus } from '../../services/policyCandidateConsensus.mjs';
import { evaluateClassificationRouteSafety } from '../../services/classificationRouteSafetyGate.mjs';
import { learnedReviewFixture } from '../fixtures/learnedEvidenceReviewFixture.mjs';

test('assesses learned agreement below policy thresholds without granting authority or mutating inputs', () => {
  const input = learnedReviewFixture(), before = structuredClone(input);
  input.aiMatch.confidence = 1;
  const assessment = assessLearnedEvidenceReview(input);
  expect(assessment).toEqual({ version: 'learned_evidence_review_v1', wouldResolve: true,
    reason: 'learned_evidence_agrees', automaticRouteAllowed: false });
  expect(assessPolicyCandidateConsensus(input).eligible).toBe(false);
  expect(evaluateClassificationRouteSafety({ result: { ...input.result, ...assessment,
    policyResult: input.policyResult } }).automatic_route_allowed).toBe(false);
  expect(input).toEqual({ ...before, aiMatch: { ...before.aiMatch, confidence: 1 } });
});

test('does not interpret absolute similarity, generated confidence or library names as probability', () => {
  const input = learnedReviewFixture();
  input.libraries.forEach(library => { library.name = 'Arbitrary renamed library'; });
  input.reviewEvidence.candidates.forEach(candidate => candidate.items.forEach(item => { item.similarity /= 2; }));
  expect(assessLearnedEvidenceReview(input).wouldResolve).toBe(true);
  input.reviewEvidence.candidates.reverse();
  input.policyResult.ranked.reverse();
  input.libraries.reverse();
  input.policies.reverse();
  expect(assessLearnedEvidenceReview(input).wouldResolve).toBe(true);
});

test.each([
  ['default input', () => undefined],
  ['no proposal', i => { i.aiMatch = null; }],
  ['abstention', i => { i.aiMatch.needs_clarification = true; }],
  ['retry', i => { i.aiMatch.needs_retry = true; }],
  ['remote authority', i => { i.aiMatch.ai_authority.providerId = 'remote'; }],
  ['missing authority', i => { delete i.aiMatch.ai_authority; }],
  ['unknown model', i => { i.aiMatch.ai_authority.model = 'unknown'; }],
  ['empty model', i => { i.aiMatch.ai_authority.model = ' '; }],
  ['non-string model', i => { i.aiMatch.ai_authority.model = 123; }],
  ['fallback', i => { i.aiMatch.ai_authority.isFallback = true; }],
  ['provider route authority', i => { i.aiMatch.ai_authority.sideEffects.canRoute = true; }],
  ['administrative review', i => { i.requireAllConfirmations = true; }],
  ['invalid identity', i => { i.metadata.tmdb_id = '999'; }],
  ['missing identity', i => { i.metadata = null; }],
  ['invalid media', i => { i.metadata.media_type = 'music'; }],
  ['automatic policy', i => { i.policyResult.action = 'auto_classify'; }],
  ['confirmation policy', i => { i.policyResult.action = 'prompt_confirm'; }],
  ['unknown review', i => { i.policyResult.decisionDiagnostics.reason_code = 'operator_hold'; }],
  ['unexplained manual flag', i => { delete i.policyResult.decisionDiagnostics.reason_code; }],
  ['no policies', i => { i.policies = null; }],
  ['empty policies', i => { i.policies = []; }],
  ['duplicate selected policy', i => { i.policies.push(i.policies[1]); }],
  ['disabled policy', i => { i.policies[1].enabled = false; }],
  ['policy media mismatch', i => { i.policies[1].library_media_type = 'tv'; }],
  ['disabled RAG', i => { i.policies[1].trust_rag = false; }],
  ['zero RAG weight', i => { i.policies[1].rag_weight = 0; }],
  ['invalid RAG weight', i => { i.policies[1].rag_weight = '1'; }],
  ['missing ranked', i => { delete i.policyResult.ranked; }],
  ['empty ranked', i => { i.policyResult.ranked = []; }],
  ['invalid ranked', i => { i.policyResult.ranked[0] = null; }],
  ['duplicate ranked', i => { i.policyResult.ranked.push(i.policyResult.ranked[0]); }],
  ['too many ranked', i => { i.policyResult.ranked = Array(65).fill(i.policyResult.ranked[0]); }],
  ['missing libraries', i => { i.libraries = null; }],
  ['duplicate libraries', i => { i.libraries.push(i.libraries[0]); }],
  ['inactive library', i => { i.libraries[1].is_active = false; }],
  ['unknown activity', i => { delete i.libraries[1].is_active; }],
  ['cross media', i => { i.libraries[1].media_type = 'tv'; }],
  ['unknown library media', i => { delete i.libraries[1].media_type; }],
  ['missing contract', i => { i.contract = null; }],
  ['invalid contract', i => { i.contract = { ...i.contract, valid: false }; }],
  ['wrong contract version', i => { i.contract = { ...i.contract, version: 'invalid' }; }],
  ['missing shortlist', i => { i.contract = { ...i.contract, candidates: null }; }],
  ['empty shortlist', i => { i.contract = { ...i.contract, candidates: [] }; }],
  ['duplicate shortlist', i => { i.contract = { ...i.contract, candidates: [i.contract.candidates[0], i.contract.candidates[0]] }; }],
  ['foreign shortlist', i => { i.contract = { ...i.contract, candidates: [i.contract.candidates[0], { libraryId: 9 }] }; }],
  ['foreign selection', i => { i.aiMatch.library = { id: 9 }; }],
  ['invalid score', i => { i.policyResult.ranked[1].score = NaN; }],
  ['zero score', i => { i.policyResult.ranked[1].score = 0; }],
  ['over-limit score', i => { i.policyResult.ranked[1].score = 101; }],
  ['invalid thresholds', i => { i.policyResult.ranked[1].prompt_threshold = 90; }],
  ['missing diagnostics', i => { delete i.policyResult.ranked[1].candidate_diagnostics; }],
  ['native conflict', i => { i.policyResult.ranked[1].native_intent_runtime = { eligible: false }; }],
  ['diagnostic native conflict', i => { i.policyResult.ranked[1].candidate_diagnostics.native_intent_runtime = { eligible: false }; }],
  ['hard exclusion', i => { i.policyResult.ranked[1].candidate_diagnostics.profile_hard_excluded = true; }],
  ['negative conflict', i => { i.policyResult.ranked[1].candidate_diagnostics.evidence_class = 'negative_conflict'; }],
  ['missing suppression report', i => { delete i.policyResult.ranked[1].candidate_diagnostics.suppression_reasons; }],
  ['unknown suppression', i => { i.policyResult.ranked[1].candidate_diagnostics.suppression_reasons.push('new_blocker'); }],
  ['constraints failed', i => { i.policyResult.ranked[1].candidate_diagnostics.policy_constraints.failed = true; }],
  ['constraints unknown', i => { i.policyResult.ranked[1].candidate_diagnostics.policy_constraints.unknown_count = 1; }],
  ['constraints conflicting', i => { i.policyResult.ranked[1].candidate_diagnostics.policy_constraints.conflict_count = 1; }],
  ['unknown constraint details', i => { i.policyResult.ranked[1].candidate_diagnostics.policy_constraints.unknown.push({}); }],
  ['constraint conflict details', i => { i.policyResult.ranked[1].candidate_diagnostics.policy_constraints.conflicts.push({}); }],
  ['unsupported constraint report', i => { i.policyResult.ranked[1].candidate_diagnostics.policy_constraints.schema_version = 2; }],
  ['selected policy conflict', i => { i.policyResult.constraintConflicts = [{ policy_id: 2 }]; }],
  ['selected library conflict', i => { i.policyResult.languageConflicts = [{ library_id: 2 }]; }],
  ['malformed conflict', i => { i.policyResult.constraintConflicts = [{}]; }],
  ['null conflict', i => { i.policyResult.constraintConflicts = [null]; }],
  ['malformed conflict list', i => { i.policyResult.languageConflicts = {}; }],
  ['no evidence', i => { i.reviewEvidence = null; }],
  ['partial evidence', i => { i.reviewEvidence.statusId = 'partial'; }],
  ['missing candidate list', i => { delete i.reviewEvidence.candidates; }],
  ['omitted competitor', i => { i.reviewEvidence.candidates.pop(); }],
  ['foreign evidence', i => { i.reviewEvidence.candidates[0].libraryId = 9; }],
  ['duplicate evidence', i => { i.reviewEvidence.candidates[0] = i.reviewEvidence.candidates[1]; }],
  ['incomplete coverage', i => { i.reviewEvidence.candidates[0].indexed--; }],
  ['missing profile', i => { delete i.reviewEvidence.candidates[0].learnedProfile; }],
  ['insufficient training', i => { i.reviewEvidence.candidates[0].learnedProfile.trainingDescriptions = 19; }],
  ['missing example', i => { i.reviewEvidence.candidates[0].items.pop(); }],
  ['shared winner', i => { i.reviewEvidence.candidates[1].items[0].sharedAcrossCandidates = true; }],
  ['unknown sharing', i => { delete i.reviewEvidence.candidates[1].items[0].sharedAcrossCandidates; }],
  ['duplicate across candidates', i => { i.reviewEvidence.candidates[0].items[0].description = '  EXAMPLE 2-0 '; }],
  ['competing neighbor', i => { i.reviewEvidence.candidates[0].items[0].similarity = .99; }],
  ['tied neighbor', i => { i.reviewEvidence.candidates[0].items[0].similarity = i.reviewEvidence.candidates[1].items[2].similarity; }],
  ['neutral metadata', i => { i.reviewEvidence.candidates[1].learnedProfile.statusId = 'neutral'; }],
  ['negative metadata', i => { i.reviewEvidence.candidates[1].learnedProfile.relativeFit = -1; }],
  ['tied metadata', i => { i.reviewEvidence.candidates[0].learnedProfile.relativeFit = 1; }],
])('retains review for %s', (name, mutate) => {
  const input = learnedReviewFixture();
  mutate(input);
  expect(assessLearnedEvidenceReview(name === 'default input' ? undefined : input).wouldResolve).toBe(false);
});

test('a fourth competitor cannot be hidden by the provider shortlist', () => {
  const input = learnedReviewFixture();
  input.policyResult.ranked.push({ ...input.policyResult.ranked[0], policy_id: 4, library_id: 4 });
  input.libraries.push({ id: 4, name: 'Fourth', is_active: true, media_type: 'movie' });
  input.reviewEvidence.candidates.push({ ...structuredClone(input.reviewEvidence.candidates[0]), libraryId: 4 });
  input.reviewEvidence.candidates[3].items[0].similarity = .99;
  expect(assessLearnedEvidenceReview(input)).toMatchObject({ wouldResolve: false, reason: 'neighbors_disagree' });
});

test('known soft/manual outcomes and unrelated excluded-policy conflicts remain assessable', () => {
  const input = learnedReviewFixture();
  input.policyResult.action = 'manual';
  input.policyResult.decisionDiagnostics.reason_code = 'weak_evidence_overlap';
  input.policyResult.constraintConflicts = [{ policy_id: 99, library_id: 99 }];
  delete input.policies[1].rag_weight;
  expect(assessLearnedEvidenceReview(input).wouldResolve).toBe(true);
  input.policyResult.decisionDiagnostics = null;
  expect(assessLearnedEvidenceReview(input).wouldResolve).toBe(true);
  expect(inspectLearnedEvidenceReviewScope()).toEqual({ reason: 'review_not_resolvable' });
});
