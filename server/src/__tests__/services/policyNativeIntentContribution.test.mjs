/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { purposeMatchFixture } from '../fixtures/purposeMatchEvidenceFixture.mjs';
import { inferredRule } from '../fixtures/inferredPurposePolicyFixture.mjs';
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { readNativeIntentContribution } from '../../services/policyNativeIntentContribution.mjs';
import { evaluatePolicy } from '../../services/policyEngineEvaluation.mjs';
import { applySpecializedDestinationIdentityEvidence } from '../../services/policySpecializedDestinationIdentityEvidence.mjs';
import { projectRankedPolicyCandidates } from '../../services/policyCandidateRankingProjection.mjs';
import { projectPolicyCandidateDecision } from '../../services/policyCandidateDecisionProjection.mjs';
import { isComparablePolicyCandidate } from '../../services/policyInferredPurposeAdmission.mjs';

const contribution = fixture => readNativeIntentContribution(
  evaluateNativePolicyIntent(fixture.policy, fixture.item), fixture.policy, fixture.item);
const deps = ({ profile = 0, rag = 0, profileDiagnostics = null, beforeProfile = () => {} } = {}) => ({
  scorePresets: async () => { throw Error('native evaluation must not use legacy presets'); },
  scoreProfileWithDiagnostics: async () => { beforeProfile(); return { score: profile, diagnostics: profileDiagnostics }; },
  scoreRAGWithDiagnostics: async () => ({ score: rag, diagnostics: null }),
});
const evaluate = (fixture, options) => evaluatePolicy(fixture.policy, fixture.item, {}, [], deps(options));
const ranked = (fixture, evaluation) => projectRankedPolicyCandidates(applySpecializedDestinationIdentityEvidence({
  evaluations: [evaluation], policies: [fixture.policy], item: fixture.item,
}));

test.each(['best_match', 'average', 'weighted_average', 'require_all'])('%s mixed purpose scores only its declared subset', mode => {
  const fixture = purposeMatchFixture({ origin: 'mixed', mode });
  fixture.policy.policy_intent_contract.purpose[1].values = { require_all: ['Animation'] };
  const runtime = evaluateNativePolicyIntent(fixture.policy, fixture.item);
  expect(runtime.purposeScore).toBeGreaterThan(80);
  expect(readNativeIntentContribution(runtime, fixture.policy, fixture.item)).toEqual({ score: 80, evidenceMode: 'identity' });
});

test.each(['profile_derived', 'unverified'])('%s keeps profile support once, with no intent or agreement vote', async origin => {
  const fixture = purposeMatchFixture({ origin });
  const result = await evaluate(fixture, { profile: 30 });
  expect(result.native_intent_runtime).toMatchObject({ eligible: true, purposeScore: 80 });
  expect(result.scores).toMatchObject({ intent: 0, profile: 30, preset: 0 });
  expect(result.breakdown[0]).toMatchObject({ type: 'native_intent', score: 0, activeWeight: 0 });
  expect(result.score).toBe(30);
  expect(result.agreement).toEqual({ multiplier: 1, contributing: 1 });
  expect(result.candidate_diagnostics).toMatchObject({ primary_viability: 'profile_only', positive_sources: { preset: null, profile: true } });
});

test('missing profile never restores inferred intent; zero-score scope admission remains comparable', async () => {
  const fixture = purposeMatchFixture({ origin: 'profile_derived' });
  expect(contribution(fixture).score).toBe(0);
  const result = await evaluate(fixture);
  expect(result.score).toBe(0);
  expect(result.native_intent_runtime.eligible).toBe(true);
  expect(isComparablePolicyCandidate(result)).toBe(true);
  expect(projectPolicyCandidateDecision({ ranked: ranked(fixture, result) }).action).toBe('manual');
});

test.each(['intent', 'profile'])('a disabled native %s weight supplies no agreement vote or positive source', async source => {
  const fixture = purposeMatchFixture();
  fixture.policy[source === 'intent' ? 'preset_weight' : 'profile_weight'] = 0;
  const result = await evaluate(fixture, { profile: 30 });
  expect(result.agreement).toEqual({ multiplier: 1, contributing: 1 });
  expect(result.score).toBe(source === 'intent' ? 30 : 80);
  expect(result.candidate_diagnostics.positive_sources[source === 'intent' ? 'preset' : 'profile']).toBe(source === 'intent' ? null : false);
});

test('a disabled intent weight does not turn observed absence into a veto of a real bound declaration', async () => {
  const fixture = purposeMatchFixture();
  fixture.policy.preset_weight = 0; fixture.policy.trust_rag = true;
  const result = await evaluate(fixture, { rag: 72, profileDiagnostics: {
    schema_version: 1, available: true, exclusions: { ratings: [{ value: 'R', score_delta: -50 }] },
  } });
  expect(result.candidate_diagnostics).toMatchObject({ profile_hard_excluded: false,
    profile_observed_absence_advisory: true, positive_sources: { preset: null, rag: true } });
  expect(result.agreement).toEqual({ multiplier: 1, contributing: 1 });
  expect(result.scores.intent).toBe(80);
  expect(result.breakdown[0].activeWeight).toBe(0);
});

test.each(['best_match', 'average', 'weighted_average', 'require_all'])('%s mismatched declaration cannot borrow an observation or helpful hint', mode => {
  const fixture = purposeMatchFixture({ origin: 'mixed', matched: false, mode });
  fixture.policy.policy_intent_contract.purpose[1].values = { require_any: ['Animation'] };
  fixture.policy.policy_intent_contract.helpful_hints = [inferredRule()];
  const runtime = evaluateNativePolicyIntent(fixture.policy, fixture.item);
  expect(runtime.eligible).toBe(false);
  expect(readNativeIntentContribution(runtime, fixture.policy, fixture.item).score).toBe(0);
});

test('matched declared subset retains the existing helpful boost and avoid penalty', () => {
  const fixture = purposeMatchFixture();
  fixture.policy.policy_intent_contract.helpful_hints = [inferredRule()];
  fixture.policy.policy_intent_contract.avoid = [{ signal_type: 'genres', operator: 'exclude', values: { exclude: ['Animation'] } }];
  expect(contribution(fixture).score).toBe(71); // 80 + (80 - 50) * .2 - 15
});

test('an unknown-origin match cannot supply a missing declared match in an otherwise admitted mixed policy', () => {
  const fixture = purposeMatchFixture({ origin: 'mixed', matched: false });
  fixture.policy.policy_intent_contract.purpose[1].source = 'unknown_origin';
  fixture.policy.policy_intent_contract.purpose[1].values = { require_any: ['Animation'] };
  const runtime = evaluateNativePolicyIntent(fixture.policy, fixture.item);
  expect(runtime.eligible).toBe(true);
  expect(runtime.purposeScore).toBe(80);
  expect(readNativeIntentContribution(runtime, fixture.policy, fixture.item).score).toBe(0);
});

test.each([null, {}, { media_type: 'movie' }, { media_type: 'movie', tmdb_id: '42' },
  { media_type: 'tv', tmdb_id: 42 }, { media_type: 'movie', tmdb_id: 43 }])('typed item %j cannot borrow a live contribution', otherItem => {
  const fixture = purposeMatchFixture();
  expect(readNativeIntentContribution(fixture.runtime, fixture.policy, otherItem).score).toBe(0);
});

test.each(['copy', 'json', 'contract', 'authority', 'classification', 'stop_eligible'])('rejects %s evidence without a private matching receipt', kind => {
  const fixture = purposeMatchFixture();
  let runtime = fixture.runtime;
  if (kind === 'copy') runtime = { ...runtime };
  if (kind === 'json') runtime = JSON.parse(JSON.stringify(runtime));
  if (kind === 'contract') fixture.policy.policy_intent_contract.purpose[0].values.require_any = ['Horror'];
  if (kind === 'authority') fixture.policy.policy_runtime_authority.validationOk = false;
  if (kind === 'classification') runtime = fixture.candidate.candidate_diagnostics;
  if (kind === 'stop_eligible') runtime.eligible = false;
  expect(readNativeIntentContribution(runtime, fixture.policy, fixture.item).score).toBe(0);
});

test('unbound current contracts and missing origin have no numeric declaration authority', async () => {
  for (const change of [f => { delete f.policy.policy_intent_contract.policy_id; },
    f => { delete f.policy.policy_runtime_authority.statusId; },
    f => { delete f.policy.policy_intent_contract.purpose[0].source; },
    f => { delete f.item.tmdb_id; }]) {
    const fixture = purposeMatchFixture(); change(fixture);
    const result = await evaluate(fixture, { profile: 40 });
    expect(result.scores.intent).toBe(0);
    expect(result.candidate_diagnostics.positive_sources.preset).toBeNull();
  }
});

test('a contract change during asynchronous support reads invalidates the intent contribution', async () => {
  const fixture = purposeMatchFixture();
  const result = await evaluate(fixture, { profile: 30, beforeProfile: () => { fixture.policy.policy_intent_contract.review_behavior = { combination_mode: 'average' }; } });
  expect(result.scores.intent).toBe(0);
  expect(result.candidate_diagnostics.positive_sources.preset).toBeNull();
});

test('mixed inferred identity cannot turn a declared broad-compatibility contribution into identity', async () => {
  const fixture = purposeMatchFixture({ origin: 'mixed' });
  fixture.item.genres.push('Comedy');
  fixture.policy.policy_intent_contract.purpose[0] = { signal_type: 'genres', source: 'native_intent',
    values: { require_any: ['Comedy'] }, semantics: 'compatibility' };
  const result = await evaluate(fixture, { profile: 90 });
  expect(result.scores.intent).toBe(80);
  expect(result.candidate_diagnostics.positive_sources.preset).toBe('compatibility');
  const projection = ranked(fixture, result);
  expect(projection[0].score).toBeLessThanOrEqual(55);
  expect(projectPolicyCandidateDecision({ ranked: projection }).action).not.toBe('auto_classify');
});

test('renormalizing after suppressing a low inferred score cannot make remaining RAG specialized proof', async () => {
  const fixture = purposeMatchFixture({ origin: 'profile_derived' });
  fixture.policy.trust_rag = true;
  fixture.policy.policy_intent_contract.purpose[0].values = { require_any: ['Horror'] };
  const result = await evaluate(fixture, { rag: 95 });
  expect(result.native_intent_runtime.eligible).toBe(true);
  expect(result.score).toBe(95);
  const projection = ranked(fixture, result);
  expect(projection[0]).toMatchObject({ score: 55, candidate_diagnostics: { primary_viability: 'compatibility_only', primary_anchor_eligible: false } });
  expect(projectPolicyCandidateDecision({ ranked: projection }).action).not.toBe('auto_classify');
});

test.each([[59.99, 'prompt_select'], [60, 'prompt_confirm'], [84.99, 'prompt_confirm'], [85, 'auto_classify']])(
  'real declared contribution retains the existing decision boundary at %s', async (target, action) => {
    const fixture = purposeMatchFixture();
    Object.assign(fixture.policy, { prompt_threshold: 60, auto_classify_threshold: 85 });
    const profile = (target * .6 / 1.05 - 80 * .35) / .25;
    const result = await evaluate(fixture, { profile });
    const projection = ranked(fixture, result);
    expect(projection[0].score).toBe(target);
    expect(projectPolicyCandidateDecision({ ranked: projection }).action).toBe(action);
  });

test.each(['R', undefined])('hard limits still prevent contributions and supporting work for %s', async certification => {
  const fixture = purposeMatchFixture(); fixture.item.certification = certification;
  fixture.policy.policy_intent_contract.hard_limits = [{ signal_type: 'certifications', constraint_mode: 'strict', values: { mode: 'max', max: 'PG-13' } }];
  const result = await evaluate(fixture, { profile: 95, beforeProfile: () => { throw Error('support must not run'); } });
  expect(result.native_intent_runtime.eligible).toBe(false);
  expect(result.scores.intent).toBe(0);
  expect(result.scores.profile).toBe(0);
});
