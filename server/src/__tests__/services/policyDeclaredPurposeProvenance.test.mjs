/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  buildPolicyDeclaredNativePurposeRuleSqlPredicate,
  buildPolicyProfileDerivedPurposeRuleSqlPredicate,
  buildPolicyPurposeProvenance,
  classifyPolicyDeclaredPurposeRuleProvenance,
  isPolicyDeclaredNativePurposeRule,
  isPolicyProfileDerivedPurposeRule,
  isPolicyPurposeProvenance,
  POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS,
  POLICY_PURPOSE_PROVENANCE_IDS,
} from '../../services/policyDeclaredPurposeProvenance.mjs';

test('recognizes only server-recorded native declarations and explicit profile observations', () => {
  const declaredRule = { source: 'native_intent', inference_state: 'declared' };
  const operatorDeclaredRule = { source: 'operator_declared_intent', inference_state: 'inferred' };
  const profileRule = {
    source: 'media_server_library_profile',
    inference_state: 'inferred',
  };
  const unknownRule = { source: 'provider_supplied_intent', inference_state: 'declared' };

  expect(isPolicyDeclaredNativePurposeRule(declaredRule)).toBe(true);
  expect(isPolicyDeclaredNativePurposeRule(operatorDeclaredRule)).toBe(true);
  expect(isPolicyProfileDerivedPurposeRule(profileRule)).toBe(true);
  expect(classifyPolicyDeclaredPurposeRuleProvenance(declaredRule)).toBe(
    POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.DECLARED_NATIVE,
  );
  expect(classifyPolicyDeclaredPurposeRuleProvenance(profileRule)).toBe(
    POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.PROFILE_DERIVED,
  );
  expect(classifyPolicyDeclaredPurposeRuleProvenance(unknownRule)).toBe(
    POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.UNVERIFIED,
  );
});

test.each([
  ['native declarations', [{ source: 'native_intent', inference_state: 'inferred' }], 'declared_native'],
  ['operator declarations', [{ source: 'operator_declared_intent', inference_state: 'inferred' }], 'declared_native'],
  ['both declaration paths', [{ source: 'native_intent' }, { source: 'operator_declared_intent' }], 'declared_native'],
  ['profile observations', [{ source: 'media_server_library_profile', inference_state: 'inferred' }], 'profile_derived'],
  ['base templates', [{ source: 'base', inference_state: 'inferred' }], 'unverified'],
  ['unknown sources', [{ source: 'unknown', inference_state: 'inferred' }], 'unverified'],
  ['missing sources', [{ inference_state: 'inferred' }], 'unverified'],
  ['unverified profile state', [{ source: 'media_server_library_profile', inference_state: 'partial' }], 'unverified'],
  ['malformed rules', [null, undefined, 'not a rule'], 'unverified'],
  ['declared and profile rules', [{ source: 'native_intent' }, { source: 'media_server_library_profile', inference_state: 'inferred' }], 'mixed'],
  ['declared and unverified rules', [{ source: 'native_intent' }, { source: 'base' }], 'mixed'],
  ['profile and unverified rules', [{ source: 'media_server_library_profile', inference_state: 'inferred' }, {}], 'mixed'],
  ['empty purpose', [], 'unverified'],
  ['null purpose', null, 'unverified'],
  ['non-array purpose', { source: 'native_intent' }, 'unverified'],
])('reduces %s to the canonical aggregate', (_label, rules, id) => {
  const result = buildPolicyPurposeProvenance(rules);

  expect(result).toEqual({
    id,
    declarationRequired: id !== POLICY_PURPOSE_PROVENANCE_IDS.DECLARED_NATIVE,
    rawRuleProvenanceExposed: false,
  });
  expect(isPolicyPurposeProvenance(result)).toBe(true);
  expect(Object.isFrozen(result)).toBe(true);
});

test('the aggregate retains no rule content or raw provenance and does not mutate input', () => {
  const rules = [{ source: 'native_intent', inference_state: 'inferred',
    values: { require_any: ['Private configured term'] }, actor_id: 74 }];
  const before = structuredClone(rules);

  expect(buildPolicyPurposeProvenance(rules)).toEqual({
    id: 'declared_native', declarationRequired: false, rawRuleProvenanceExposed: false,
  });
  expect(rules).toEqual(before);
  expect(buildPolicyPurposeProvenance()).toEqual({
    id: 'unverified', declarationRequired: true, rawRuleProvenanceExposed: false,
  });
});

test.each([
  undefined, null, [], 'declared_native', 1, {},
  { id: 'unknown', declarationRequired: true, rawRuleProvenanceExposed: false },
  { id: 'declared_native', declarationRequired: true, rawRuleProvenanceExposed: false },
  { id: 'profile_derived', declarationRequired: false, rawRuleProvenanceExposed: false },
  { id: 'mixed', declarationRequired: 'true', rawRuleProvenanceExposed: false },
  { id: 'unverified', declarationRequired: true, rawRuleProvenanceExposed: true },
  { id: 'declared_native', declarationRequired: false, rawRuleProvenanceExposed: false, source: 'native_intent' },
])('rejects a malformed or contradictory aggregate %j', value => {
  expect(isPolicyPurposeProvenance(value)).toBe(false);
});

test('builds only static SQL provenance predicates and rejects unsafe aliases', () => {
  expect(buildPolicyDeclaredNativePurposeRuleSqlPredicate({ ruleAlias: 'intent_rule' })).toBe(
    "intent_rule.source IN ('native_intent', 'operator_declared_intent')",
  );
  expect(buildPolicyProfileDerivedPurposeRuleSqlPredicate({ ruleAlias: 'intent_rule' })).toBe(
    "intent_rule.source = 'media_server_library_profile'\n" +
    "             AND intent_rule.inference_state = 'inferred'",
  );
  expect(() => buildPolicyDeclaredNativePurposeRuleSqlPredicate({
    ruleAlias: 'intent_rule; DROP TABLE policy_intent_rules',
  })).toThrow('policy_declared_purpose_provenance_sql_alias_invalid');
});
