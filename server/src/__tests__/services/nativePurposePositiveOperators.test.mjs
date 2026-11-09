/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { scoreNativeIntentRule, scoreNativeIntentRules } from '../../services/policyNativeIntentRuleScoring.mjs';
import { evaluatePresetSignals } from '../../services/policyEngineSignalScoring.mjs';
import { normalizePolicyNativeIntentChangePurposeCommand, buildPolicyNativeIntentChangePurposePreflightCandidate } from '../../services/policyNativeIntentChangePurposePreflightContract.mjs';
import { purposeMatchFixture } from '../fixtures/purposeMatchEvidenceFixture.mjs';
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { readNativeIntentContribution } from '../../services/policyNativeIntentContribution.mjs';
import { applySpecializedDestinationIdentityEvidence } from '../../services/policySpecializedDestinationIdentityEvidence.mjs';
import { evaluatePolicy } from '../../services/policyEngineEvaluation.mjs';
import { projectRankedPolicyCandidates } from '../../services/policyCandidateRankingProjection.mjs';
import { projectPolicyCandidateDecision } from '../../services/policyCandidateDecisionProjection.mjs';
import { readNativePurposePositiveRule } from '../../services/nativePurposePositiveSemantics.mjs';

const signals = ['genres', 'keywords', 'studios', 'media_type'];
const operators = ['require_any', 'require_all', 'include', 'prefer'];
const rule = (signal, operator, terms, semantics = 'identity') => ({ intent_role: 'purpose',
  signal_type: signal, operator, values: { [operator]: terms }, semantics,
  constraint_mode: 'advisory', source: 'operator_declared_intent', inference_state: 'inferred' });
const fullItem = { media_type: 'movie', tmdb_id: 42, genres: ['alpha', 'beta'],
  keywords: ['alpha', 'beta'], studios: ['alpha', 'beta'] };
const partialItem = { media_type: 'movie', tmdb_id: 42, genres: ['alpha'], keywords: ['alpha'], studios: ['alpha'] };
const missItem = { media_type: 'tv', tmdb_id: 42, genres: ['other'], keywords: ['other'], studios: ['other'] };
const legacy = (entry, item) => evaluatePresetSignals({ [entry.signal_type]: {
  ...entry.values, semantics: entry.semantics, constraint_mode: entry.constraint_mode } }, item);

test.each(signals.flatMap(signal => operators.flatMap(operator => ['identity', 'compatibility'].map(semantics =>
  [signal, operator, semantics]))))('%s %s %s executes accepted positive meaning with actual numeric scores', (signal, operator, semantics) => {
  const terms = signal === 'media_type' ? ['movie'] : ['alpha', 'beta'];
  const entry = rule(signal, operator, terms, semantics);
  // Exercise the real accepted authoring shape too, rather than invent a test-only contract.
  expect(normalizePolicyNativeIntentChangePurposeCommand({ command_id: 'update_purpose',
    values: [{ signal_type: signal, operator, values: entry.values, semantics }] }).values[0].operator).toBe(operator);
  const fullScore = operator === 'require_all' || (signal === 'media_type' && operator === 'include') ? 100 : 80;
  expect(scoreNativeIntentRule(entry, fullItem)).toBe(fullScore);
  expect(scoreNativeIntentRule(entry, missItem)).toBe(operator === 'prefer' && semantics === 'compatibility' ? 50 : 0);
  const missingScore = semantics === 'compatibility' && (operator === 'prefer' || (signal === 'media_type' && operator === 'include')) ? 50 : 0;
  expect(scoreNativeIntentRule(entry, {})).toBe(missingScore);
  if (signal !== 'media_type') expect(scoreNativeIntentRule(entry, partialItem)).toBe(
    operator === 'require_all' ? 0 : operator === 'prefer' ? 65 : 80);
  else expect(scoreNativeIntentRule(rule(signal, 'require_all', ['movie', 'tv'], semantics), fullItem)).toBe(0);
});

test.each(signals)('%s exclusions retain their legacy match/miss/missing and combination behavior', signal => {
  const entry = rule(signal, 'exclude', [signal === 'media_type' ? 'movie' : 'alpha']);
  for (const item of [fullItem, missItem, {}]) expect(scoreNativeIntentRule(entry, item)).toBe(legacy(entry, item));
});

test.each(['best_match', 'average', 'weighted_average', 'require_all'])('%s retains weight and negative combination meaning', mode => {
  const positive = rule('keywords', 'require_all', ['alpha', 'beta']);
  positive.values.weight = 3;
  const negative = rule('genres', 'exclude', ['not-present']);
  const expected = { best_match: 100, average: 75, weighted_average: 87.5, require_all: 0 };
  expect(scoreNativeIntentRules([positive, negative], fullItem, mode)).toBe(expected[mode]);
});

test.each([
  { source: 'media_server_library_profile' }, { source: 'unknown' }, { source: undefined },
  { semantics: undefined }, { intent_role: 'helpful_hint' }, { intent_role: 'avoid' },
  { values: { require_any: ['alpha'], exclude: ['beta'] } }, { operator: 'require_all' },
])('retains legacy execution for noncanonical/other-role rules %j', change => {
  const entry = { ...rule('keywords', 'require_any', ['alpha']), ...change };
  for (const item of [fullItem, missItem, {}]) expect(scoreNativeIntentRule(entry, item)).toBe(legacy(entry, item));
});

test('keeps existing text boundaries, metadata encodings and production-company matching', () => {
  const keywords = rule('keywords', 'require_all', ['alpha', 'beta']);
  expect(scoreNativeIntentRule(keywords, { title: 'Alpha', overview: 'a beta story' })).toBe(100);
  expect(scoreNativeIntentRule(keywords, { title: 'Alphabet betamax' })).toBe(0);
  expect(scoreNativeIntentRule(rule('genres', 'include', ['alpha']), { genres: '[{"name":"ALPHA"}]' })).toBe(80);
  expect(scoreNativeIntentRule(rule('studios', 'require_all', ['alpha', 'beta']), {
    production_companies: '[{"name":"Alpha Pictures"},{"name":"Beta Works"}]' })).toBe(100);
});

test('new interpretation admits exactly the bounded canonical shape, including UTF-16 and valid numeric weights', () => {
  const entry = rule('genres', 'include', ['alpha']);
  for (const values of [{ include: [] }, { include: Array(51).fill('alpha') }, { include: [' alpha'] },
    { include: ['\u00a0alpha'] }, { include: ['\u{1f600}'.repeat(61)] }, { include: [42] },
    { include: ['alpha'], other: true }, { include: ['alpha'], weight: 0 },
    { include: ['alpha'], weight: Infinity }, { include: ['alpha'], weight: '2' }]) {
    const invalid = { ...entry, values };
    expect(readNativePurposePositiveRule(invalid)).toBeNull();
    expect(scoreNativeIntentRule(invalid, fullItem)).toBe(legacy(invalid, fullItem));
  }
  expect(readNativePurposePositiveRule({ ...entry, values: { include: Array(50).fill('alpha'), weight: 2 } })).not.toBeNull();
  expect(readNativePurposePositiveRule({ ...entry, values: { include: ['\u{1f600}'.repeat(60)] } })).not.toBeNull();
});

test.each([
  ['genres', 'require_any'], ['genres', 'require_all'], ['genres', 'prefer'],
  ['keywords', 'require_any'], ['keywords', 'prefer'], ['studios', 'require_any'],
  ['studios', 'prefer'], ['media_type', 'include'],
])('%s %s preserves existing scores for both semantics and normal/malformed metadata', (signal, operator) => {
  for (const semantics of ['identity', 'compatibility']) {
    for (const weight of [undefined, 0.3, 1.3, Number.MIN_VALUE, Number.MAX_VALUE]) {
      const entry = rule(signal, operator, signal === 'media_type' ? ['movie'] : ['alpha', 'beta'], semantics);
      if (weight !== undefined) entry.values.weight = weight;
      for (const item of [fullItem, partialItem, missItem, {}, { studios: 'not json' },
        { genres: '[{"name":"alpha"}]', keywords: '["alpha"]', production_companies: '[{"name":"alpha"}]' },
        { keywords: ['alpha'], overview: 42 }, { media_type: 42 }]) {
        expect(scoreNativeIntentRule(entry, item)).toBe(legacy(entry, item));
      }
    }
  }
});

test.each(['genres', 'keywords', 'studios'])('%s include supplies the same bound positive and required-term evidence', async signal => {
  const fixture = purposeMatchFixture();
  fixture.item = { ...fullItem };
  fixture.policy.policy_intent_contract.purpose = [rule(signal, 'include', ['alpha', 'beta'])];
  const runtime = evaluateNativePolicyIntent(fixture.policy, fixture.item);
  expect(runtime).toMatchObject({ eligible: true, purposeScore: 80, purposeEvidence: { declaredMatch: 'matched' } });
  expect(readNativeIntentContribution(runtime, fixture.policy, fixture.item)).toEqual({ score: 80, evidenceMode: 'identity' });
  expect(readNativeIntentContribution({ ...runtime }, fixture.policy, fixture.item).score).toBe(0);
  expect(readNativeIntentContribution(runtime, fixture.policy, { ...fixture.item, tmdb_id: 43 }).score).toBe(0);
  const command = { command_id: 'update_purpose', values: [{ signal_type: signal, operator: 'include',
    values: { include: ['alpha', 'beta'] }, semantics: 'identity' }] };
  expect(buildPolicyNativeIntentChangePurposePreflightCandidate(command)).toMatchObject({ requiredTermCount: 2, requiredSignalTypeCount: 1 });
  const deps = { scorePresets: async () => { throw Error('legacy path must not run'); },
    scoreProfileWithDiagnostics: async () => ({ score: 0 }), scoreRAGWithDiagnostics: async () => ({ score: 0 }) };
  const result = await evaluatePolicy(fixture.policy, fixture.item, {}, [], deps);
  expect(result.scores.intent).toBe(80);
  const competitor = structuredClone(fixture.policy);
  competitor.id = 15; competitor.library_id = 5;
  Object.assign(competitor.policy_intent_contract, { policy_id: 15, library_id: 5, purpose: [rule(signal, 'include', ['alpha'])] });
  const other = await evaluatePolicy(competitor, fixture.item, {}, [], deps);
  const specialize = () => applySpecializedDestinationIdentityEvidence({ item: fixture.item,
    policies: [fixture.policy, competitor], evaluations: [result, other] });
  const evaluated = specialize();
  expect(evaluated[0].candidate_diagnostics.identity_evidence).toMatchObject({ status_id: 'positive_specialized_evidence', unique_signal_count: 1, shared_signal_count: 1 });
  expect(evaluated[1].candidate_diagnostics.identity_evidence.status_id).toBe('broad_compatibility_overlap');
  for (const [threshold, action] of [[80, 'auto_classify'], [80.01, 'prompt_confirm']]) {
    const ranked = projectRankedPolicyCandidates(evaluated);
    ranked[0].auto_classify_threshold = threshold; ranked[0].prompt_threshold = 60;
    expect(projectPolicyCandidateDecision({ ranked }).action).toBe(action);
  }
  fixture.policy.library_name = 'Completely unrelated category'; competitor.library_name = 'Renamed destination';
  expect(specialize()).toEqual(evaluated);
});

test.each([['genres', 'prefer', 'identity'], ['genres', 'include', 'compatibility'], ['media_type', 'require_any', 'identity']])(
  '%s %s %s does not acquire specialized identity', (signal, operator, semantics) => {
    const fixture = purposeMatchFixture(); fixture.item = fullItem;
    fixture.policy.policy_intent_contract.purpose = [rule(signal, operator, [signal === 'media_type' ? 'movie' : 'alpha'], semantics)];
    const [result] = applySpecializedDestinationIdentityEvidence({ item: fixture.item, policies: [fixture.policy],
      evaluations: [fixture.candidate] });
    expect(result.candidate_diagnostics.identity_evidence.unique_signal_count).toBe(0);
    const command = { command_id: 'update_purpose', values: [{ signal_type: signal, operator,
      values: { [operator]: [signal === 'media_type' ? 'movie' : 'alpha'] }, semantics }] };
    expect(buildPolicyNativeIntentChangePurposePreflightCandidate(command).requiredTermCount).toBe(0);
  });
