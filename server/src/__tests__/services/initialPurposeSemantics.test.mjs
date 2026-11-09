/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { purposeMatchFixture } from '../fixtures/purposeMatchEvidenceFixture.mjs';
import { buildInitialPolicyIntentContract } from '../../services/policyInitialIntentEstablishmentContract.mjs';
import { normalizePolicyNativeIntentChangePurposeCommand } from '../../services/policyNativeIntentChangePurposePreflightContract.mjs';
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { readNativeIntentContribution } from '../../services/policyNativeIntentContribution.mjs';
import { readNativePurposePositiveRule } from '../../services/nativePurposePositiveSemantics.mjs';
import { evaluatePolicy } from '../../services/policyEngineEvaluation.mjs';
import { applySpecializedDestinationIdentityEvidence } from '../../services/policySpecializedDestinationIdentityEvidence.mjs';
import { projectRankedPolicyCandidates } from '../../services/policyCandidateRankingProjection.mjs';
import { projectPolicyCandidateDecision } from '../../services/policyCandidateDecisionProjection.mjs';

const entry = (operator, semantics, term = 'Animation') => ({ signal_type: 'genres', operator,
  values: { [operator]: [term] }, semantics });
function initial(purpose, mode = 'best_match') {
  const fixture = purposeMatchFixture({ mode });
  fixture.policy.policy_intent_contract = buildInitialPolicyIntentContract({ policy: fixture.policy, declaredIntent: { purpose } });
  return fixture;
}
test.each(['identity', 'compatibility'])('initial %s has the same actual contribution as the existing edit path', semantics => {
  const rule = entry('include', semantics), fixture = initial([rule]);
  const runtime = evaluateNativePolicyIntent(fixture.policy, fixture.item);
  expect(runtime.eligible).toBe(true);
  expect(readNativeIntentContribution(runtime, fixture.policy, fixture.item)).toEqual({ score: 80, evidenceMode: semantics });
  const nativeEdit = normalizePolicyNativeIntentChangePurposeCommand({ command_id: 'update_purpose', values: [rule] });
  fixture.policy.policy_intent_contract.purpose = nativeEdit.values.map(value => ({ ...value, intent_role: 'purpose' }));
  const edited = evaluateNativePolicyIntent(fixture.policy, fixture.item);
  expect(readNativeIntentContribution(edited, fixture.policy, fixture.item)).toEqual({ score: 80, evidenceMode: semantics });
});
test.each([['best_match', 95, true], ['average', 75, true], ['weighted_average', 75, true], ['require_all', 0, false]])(
  'fresh compatibility retains neutral-50 %s aggregation', (mode, expected, eligible) => {
    const fixture = initial([entry('require_all', 'identity'), entry('prefer', 'compatibility', 'Unmatched')], mode);
    const runtime = evaluateNativePolicyIntent(fixture.policy, fixture.item);
    expect(runtime.purposeScore).toBe(expected);
    expect(runtime.eligible).toBe(eligible);
    fixture.policy.policy_intent_contract.purpose[1].semantics = 'identity';
    const identity = evaluateNativePolicyIntent(fixture.policy, fixture.item);
    if (mode === 'average' || mode === 'weighted_average') {
      expect(identity.purposeScore).toBe(50);
      expect(identity.eligible).toBe(false);
    }
  });
test('neutral compatibility alone cannot admit and a matching compatibility cannot mint specialized identity', async () => {
  const neutral = initial([entry('prefer', 'compatibility', 'Unmatched')]);
  expect(evaluateNativePolicyIntent(neutral.policy, neutral.item)).toMatchObject({ eligible: false, purposeScore: 50 });
  const fixture = initial([entry('include', 'compatibility')]);
  expect(readNativePurposePositiveRule(fixture.policy.policy_intent_contract.purpose[0]).requiredTerms).toEqual([]);
  const evaluation = await evaluatePolicy(fixture.policy, fixture.item, {}, [], {
    scorePresets: async () => { throw Error('Must not use legacy presets'); },
    scoreProfileWithDiagnostics: async () => ({ score: 0, diagnostics: null }),
    scoreRAGWithDiagnostics: async () => ({ score: 0, diagnostics: null }),
  });
  expect(evaluation.scores.intent).toBe(80);
  expect(evaluation.candidate_diagnostics.positive_sources.preset).toBe('compatibility');
  const ranked = projectRankedPolicyCandidates(applySpecializedDestinationIdentityEvidence({
    evaluations: [evaluation], policies: [fixture.policy], item: fixture.item,
  }));
  expect(ranked[0].score).toBeLessThanOrEqual(55);
  expect(ranked[0].candidate_diagnostics.primary_anchor_eligible).toBe(false);
  expect(projectPolicyCandidateDecision({ ranked }).action).not.toBe('auto_classify');
});
test('category and display names cannot change initial declared semantics or contribution', () => {
  const fixture = initial([entry('include', 'compatibility')]);
  const evaluate = () => readNativeIntentContribution(evaluateNativePolicyIntent(fixture.policy, fixture.item), fixture.policy, fixture.item);
  const before = evaluate();
  fixture.policy.name = 'Arbitrary category'; fixture.policy.library_name = 'Entirely unrelated destination';
  expect(evaluate()).toEqual(before);
});
