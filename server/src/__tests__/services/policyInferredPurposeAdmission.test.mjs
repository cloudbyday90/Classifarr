/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from '@jest/globals';
import { inferredPolicy, inferredRule } from '../fixtures/inferredPurposePolicyFixture.mjs';
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { INFERRED_PURPOSE_ADMISSION, isInferredProfilePurposeRule, isInferredPurposeCandidate,
  isComparablePolicyCandidate } from '../../services/policyInferredPurposeAdmission.mjs';

const item = { media_type: 'movie', genres: ['Fantasy', 'Romance'] };
const candidate = () => ({ score: 0, native_intent_runtime: evaluateNativePolicyIntent(inferredPolicy(), item) });

describe('inferred purpose admission', () => {
  test.each(['best_match', 'average', 'weighted_average', 'require_all'])('%s admits non-top genres without a fabricated score', mode => {
    const policy = inferredPolicy(); policy.policy_intent_contract.review_behavior.combination_mode = mode;
    const result = evaluateNativePolicyIntent(policy, item);
    expect(result).toMatchObject({ eligible: true, score: 0, admissionBasis: INFERRED_PURPOSE_ADMISSION });
    expect(isInferredPurposeCandidate({ native_intent_runtime: result })).toBe(true);
  });

  test.each([undefined, [], ['Unseen genre']])('missing or novel genres %j remain eligible', genres => {
    expect(evaluateNativePolicyIntent(inferredPolicy(), { ...item, genres })).toMatchObject({ eligible: true, score: 0 });
  });

  test('observed matches retain their ranking score; names have no admission role', () => {
    const policy = inferredPolicy({ library_name: 'Completely arbitrary label' });
    expect(evaluateNativePolicyIntent(policy, { ...item, genres: ['Animation'] })).toMatchObject({ eligible: true, score: 80 });
  });

  test.each([undefined, 'tv', 'unknown', 'MOVIE'])('unknown or mismatched media %j cannot use inferred admission', media_type => {
    expect(evaluateNativePolicyIntent(inferredPolicy(), { ...item, media_type }).eligible).toBe(false);
  });

  test('TV uses the same organic admission and stored media constraints remain enforced', () => {
    const policy = inferredPolicy({ library_media_type: 'tv' });
    expect(evaluateNativePolicyIntent(policy, { media_type: 'tv' }).eligible).toBe(false);
    policy.policy_intent_contract.purpose[1].values.require_any = ['tv'];
    expect(evaluateNativePolicyIntent(policy, { media_type: 'tv' }).eligible).toBe(true);
  });

  test.each(['operator_declared', 'unknown', undefined])('non-profile provenance %j keeps required purpose', source => {
    const policy = inferredPolicy(); policy.policy_intent_contract.purpose = [inferredRule({ source })];
    expect(evaluateNativePolicyIntent(policy, item)).toMatchObject({ eligible: false, score: 0 });
  });

  test.each(['best_match', 'average', 'weighted_average', 'require_all'])('mixed %s contracts cannot satisfy a declaration with observations', mode => {
    const policy = inferredPolicy(); policy.policy_intent_contract.review_behavior.combination_mode = mode;
    policy.policy_intent_contract.purpose.push(inferredRule({ source: 'operator_declared', values: { require_any: ['Mystery'] } }));
    expect(evaluateNativePolicyIntent(policy, { ...item, genres: ['Animation'] }).eligible).toBe(false);
    expect(evaluateNativePolicyIntent(policy, { ...item, genres: ['Mystery'] }).eligible).toBe(true);
  });

  test.each(['R', undefined])('explicit hard limits still block failed/unknown certification %j', certification => {
    const policy = inferredPolicy(); policy.policy_intent_contract.hard_limits = [{ signal_type: 'certifications',
      constraint_mode: 'strict', values: { mode: 'max', max: 'PG-13' } }];
    expect(evaluateNativePolicyIntent(policy, { ...item, certification }).eligible).toBe(false);
  });

  test('invalid authority and empty purpose cannot use admission; hints alone create no score', () => {
    const policy = inferredPolicy(); policy.policy_runtime_authority.validationOk = false;
    expect(evaluateNativePolicyIntent(policy, item).eligible).toBe(false);
    policy.policy_runtime_authority.validationOk = true; policy.policy_intent_contract.validation.valid = false;
    expect(evaluateNativePolicyIntent(policy, item).eligible).toBe(false);
    policy.policy_intent_contract.validation.valid = true;
    policy.policy_intent_contract.helpful_hints = [inferredRule({ signal_type: 'genres', values: { require_any: ['Fantasy'] } })];
    expect(evaluateNativePolicyIntent(policy, item)).toMatchObject({ eligible: true, score: 0, helpfulBoost: 0 });
    policy.policy_intent_contract.purpose = [];
    expect(evaluateNativePolicyIntent(policy, item).eligible).toBe(false);
  });

  test.each([null, undefined, {}, { intent_role: 'avoid' }, { inference_state: 'partial' },
    { constraint_mode: 'strict' }, { signal_type: 'keywords' }, { operator: 'exclude' },
    { values: null }, { values: undefined }, { values: [] }, { values: 'bad' },
    { values: {} }, { values: { require_any: [] } }, { values: { require_any: [null] } },
    { values: { require_any: [' '] } }, { values: { require_any: ['Animation'], strict: true } },
    { values: { require_any: ['Animation'], exclude: ['Fantasy'] } },
  ])('does not relax unrecognized observation shape %j', overrides => {
    const rule = overrides == null || Object.keys(overrides).length === 0 ? overrides : inferredRule(overrides);
    expect(isInferredProfilePurposeRule(rule)).toBe(false);
  });

  test('only finite nonnegative admitted candidates survive comparison', () => {
    expect(isInferredProfilePurposeRule(inferredRule({ values: { require_any: ['Animation'], weight: 2 } }))).toBe(true);
    expect(isComparablePolicyCandidate(candidate())).toBe(true);
    expect(isComparablePolicyCandidate({ score: 20 })).toBe(true);
    for (const score of [NaN, Infinity, -1, '20']) expect(isComparablePolicyCandidate({ ...candidate(), score })).toBe(false);
    expect(isComparablePolicyCandidate({ score: 0 })).toBe(false);
    expect(isComparablePolicyCandidate(undefined)).toBe(false);
    expect(isInferredPurposeCandidate(null)).toBe(false);
    const row = candidate(); row.native_intent_runtime.eligible = false;
    expect(isComparablePolicyCandidate({ ...row, score: 95 })).toBe(false);
  });

  test('admission does not preserve conflict or incomplete diagnostic rows', () => {
    for (const patch of [{ eligible: false }, { admissionBasis: 'unknown' }, { constraintDiagnostics: null },
      { constraintDiagnostics: { failed: true } },
      { constraintDiagnostics: { failed: false, unknown_count: 1 } },
      { constraintDiagnostics: { failed: false, unknown_count: 0, conflict_count: 1 } }]) {
      const row = candidate(); Object.assign(row.native_intent_runtime, patch);
      expect(isInferredPurposeCandidate(row)).toBe(false);
    }
    for (const diagnostics of [{ profile_hard_excluded: true }, { evidence_class: 'negative_conflict' }]) {
      expect(isComparablePolicyCandidate({ ...candidate(), candidate_diagnostics: diagnostics })).toBe(false);
    }
  });
});
