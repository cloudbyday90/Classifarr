/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  buildPolicyDeclaredNativePurposeRuleSqlPredicate,
  buildPolicyProfileDerivedPurposeRuleSqlPredicate,
  classifyPolicyDeclaredPurposeRuleProvenance,
  isPolicyDeclaredNativePurposeRule,
  isPolicyProfileDerivedPurposeRule,
  POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS,
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
