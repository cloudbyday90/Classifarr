/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { buildPolicyCandidateEvidenceCard } from '../../services/policyCandidateEvidenceCard.mjs';
import { buildLegacyPolicyCandidateEvidenceCard } from '../../services/policyCandidateLegacyEvidenceCard.mjs';
import { readPolicyPurposeMatchPresentation, refinePolicyPurposeMatchEvidence, validPolicyPurposeMatchEvidence } from '../../services/policyPurposeMatchEvidence.mjs';
import { purposeMatchFixture } from '../fixtures/purposeMatchEvidenceFixture.mjs';
import { applySpecializedDestinationIdentityEvidence } from '../../services/policySpecializedDestinationIdentityEvidence.mjs';
import { formatPolicySignals } from '../../services/aiPromptBuilderFormatters.mjs';
const state = card => card.sources.find(row => row.source_id === 'declared_policy').state_id;

test.each(['best_match', 'average', 'weighted_average', 'require_all'])('declared subset matches with existing %s semantics', mode => {
  const fixture = purposeMatchFixture({ mode });
  expect(fixture.proof.declaredMatch).toBe('matched'); expect(state(buildPolicyCandidateEvidenceCard(fixture))).toBe('supporting');
  expect(Object.isFrozen(fixture.runtime.purposeEvidence)).toBe(true);
  expect(JSON.stringify(buildPolicyCandidateEvidenceCard(fixture))).not.toMatch(/policyId|tmdbId|Animation|operator_declared/);
});

test.each(['profile_derived', 'mixed', 'unverified'])('keeps %s origin separate from native admission', origin => {
  const fixture = purposeMatchFixture({ origin }), card = buildPolicyCandidateEvidenceCard(fixture);
  expect(card.purpose_evidence.origin).toBe(origin);
  expect(card.purpose_evidence.runtimeEligible).toBe(true);
  expect(state(card)).toBe(origin === 'mixed' ? 'supporting' : origin === 'profile_derived' ? 'contextual' : 'unavailable');
});

test('mixed declared mismatch cannot borrow an inferred match', () => {
  const fixture = purposeMatchFixture({ origin: 'mixed', matched: false });
  fixture.policy.policy_intent_contract.purpose[1].values.require_any = ['Animation'];
  const runtime = evaluateNativePolicyIntent(fixture.policy, fixture.item);
  expect(runtime.purposeEvidence.declaredMatch).toBe('not_matched');
});

test('mixed unknown/profile origins do not imply a declaration exists', () => {
  const fixture = purposeMatchFixture({ origin: 'mixed' });
  fixture.policy.policy_intent_contract.purpose[0].source = 'unknown';
  const runtime = evaluateNativePolicyIntent(fixture.policy, fixture.item);
  expect(runtime.purposeEvidence).toMatchObject({ origin: 'mixed', declaredMatch: 'no_declared_rules' });
});

test.each(['broad_compatibility_overlap', 'insufficient_specialized_evidence', 'not_evaluated'])('matched declaration preserves %s restriction', specificity => {
  const fixture = purposeMatchFixture({ specificity });
  expect(fixture.proof.declaredMatch).toBe('matched'); expect(state(buildPolicyCandidateEvidenceCard(fixture))).toBe('contextual');
  expect(buildPolicyCandidateEvidenceCard(fixture).status_id).toBe('counter_evidence_recommended');
});

test('blocked native contract cannot imply a positive declared match', () => {
  const fixture = purposeMatchFixture();
  fixture.policy.policy_intent_contract.hard_limits = [{ intent_role: 'hard_limit', signal_type: 'certifications',
    operator: 'max', values: { mode: 'max', max: 'PG-13' }, constraint_mode: 'strict' }];
  fixture.item.certification = 'R';
  const runtime = evaluateNativePolicyIntent(fixture.policy, fixture.item);
  expect(runtime.eligible).toBe(false); expect(runtime.purposeEvidence.declaredMatch).toBe('not_evaluated');
});

test('specialization refuses copied proof, changed authority/rules or item identity', () => {
  const fixture = purposeMatchFixture(), original = fixture.runtime.purposeEvidence;
  expect(refinePolicyPurposeMatchEvidence(structuredClone(original), fixture.policy, fixture.item, 'positive_specialized_evidence')).toBeNull();
  expect(refinePolicyPurposeMatchEvidence(original, fixture.policy, { ...fixture.item, tmdb_id: 43 }, 'positive_specialized_evidence')).toBeNull();
  fixture.policy.policy_intent_contract.purpose[0].values.require_any = ['Horror'];
  expect(refinePolicyPurposeMatchEvidence(original, fixture.policy, fixture.item, 'positive_specialized_evidence')).toBeNull();
});

test('live specialization refines bound evidence without changing numeric or provider inputs', () => {
  const fixture = purposeMatchFixture();
  const candidate = { ...fixture.candidate, candidate_diagnostics: {
    ...fixture.candidate.candidate_diagnostics, purpose_evidence: fixture.runtime.purposeEvidence,
  } };
  const [refined] = applySpecializedDestinationIdentityEvidence({ evaluations: [candidate], policies: [fixture.policy], item: fixture.item });
  expect(refined.candidate_diagnostics.purpose_evidence.specificity).toBe('positive_specialized_evidence');
  expect(refined.score).toBe(candidate.score);
  expect(refinePolicyPurposeMatchEvidence(refined.candidate_diagnostics.purpose_evidence,
    fixture.policy, fixture.item, 'positive_specialized_evidence')).toEqual(refined.candidate_diagnostics.purpose_evidence);
  const context = { confidence: 70, candidateDiagnostics: refined.candidate_diagnostics };
  const { purpose_evidence: _diagnostic, ...legacyDiagnostics } = refined.candidate_diagnostics;
  expect(formatPolicySignals(context)).toBe(formatPolicySignals({ ...context, candidateDiagnostics: legacyDiagnostics }));
});

test('a changed contract between native evaluation and specialization leaves a presentation gap', () => {
  const fixture = purposeMatchFixture();
  const candidate = { ...fixture.candidate, candidate_diagnostics: {
    ...fixture.candidate.candidate_diagnostics, purpose_evidence: fixture.runtime.purposeEvidence,
  } };
  fixture.policy.policy_intent_contract.purpose[0].values.require_any = ['Horror'];
  const [refined] = applySpecializedDestinationIdentityEvidence({ evaluations: [candidate], policies: [fixture.policy], item: fixture.item });
  expect(refined.candidate_diagnostics.purpose_evidence).toBeNull();
  expect(refined.score).toBe(candidate.score);
});

test.each(['manual_classification', 'source_library', 'legacy', 'wrong_item', 'wrong_candidate', 'unbound_capture', 'invalid_proof'])
('rejects %s retained metadata even if diagnostic flags look positive', kind => {
  const fixture = purposeMatchFixture();
  if (['manual_classification', 'source_library'].includes(kind)) fixture.classification.method = kind;
  if (kind === 'legacy') delete fixture.candidate.candidate_diagnostics.purpose_evidence;
  if (kind === 'wrong_item') fixture.classification.tmdb_id = 43;
  if (kind === 'wrong_candidate') fixture.candidate = { ...fixture.candidate, policy_id: 15 };
  if (kind === 'unbound_capture') fixture.sourceMetadata.classification_details.candidate_capture.library_id = 5;
  if (kind === 'invalid_proof') fixture.candidate.candidate_diagnostics.purpose_evidence = { ...fixture.proof, raw: 'PRIVATE' };
  expect(readPolicyPurposeMatchPresentation(fixture).origin).toBe('unverified'); expect(state(buildPolicyCandidateEvidenceCard(fixture))).toBe('unavailable');
});

test('legacy analytics keep original heuristic while current card rejects its unverified origin', () => {
  const fixture = purposeMatchFixture(); fixture.classification.method = 'manual_classification';
  expect(state(buildLegacyPolicyCandidateEvidenceCard(fixture))).toBe('supporting');
  expect(buildLegacyPolicyCandidateEvidenceCard(fixture).version).toBe('policy.candidate_evidence_card.v1');
  expect(state(buildPolicyCandidateEvidenceCard(fixture))).toBe('unavailable');
  expect(validPolicyPurposeMatchEvidence({ ...fixture.proof, policyId: null })).toBe(false);
});
