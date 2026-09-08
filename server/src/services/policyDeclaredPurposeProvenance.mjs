/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

/**
 * Authoritative provenance is fixed at the server write boundary. The values
 * identify how a purpose rule entered native policy storage; they do not
 * identify a library, provider, configuration, rule value, or actor.
 */
export const POLICY_DECLARED_PURPOSE_RULE_SOURCE_IDS = Object.freeze({
  NATIVE_INTENT: 'native_intent',
  OPERATOR_DECLARED_INTENT: 'operator_declared_intent',
  PROFILE_OBSERVATION: 'media_server_library_profile',
});

export const POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS = Object.freeze({
  DECLARED_NATIVE: 'declared_native',
  PROFILE_DERIVED: 'profile_derived',
  UNVERIFIED: 'unverified',
});

const DECLARED_NATIVE_SOURCE_IDS = new Set([
  POLICY_DECLARED_PURPOSE_RULE_SOURCE_IDS.NATIVE_INTENT,
  POLICY_DECLARED_PURPOSE_RULE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
]);

function sqlAlias(value, fallback) {
  const alias = typeof value === 'string' ? value : fallback;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(alias)) {
    throw new TypeError('policy_declared_purpose_provenance_sql_alias_invalid');
  }
  return alias;
}

/**
 * The profile source is descriptive only when it is explicitly recorded as an
 * inferred library observation. Other source/state combinations fail closed.
 */
export function isPolicyProfileDerivedPurposeRule(rule = {}) {
  return rule?.source === POLICY_DECLARED_PURPOSE_RULE_SOURCE_IDS.PROFILE_OBSERVATION &&
    rule?.inference_state === 'inferred';
}

/**
 * Native declarations are written only by the server's established-intent or
 * revision-checked native-purpose command paths. A source name alone from an
 * arbitrary provider, library, or configuration is never enough.
 */
export function isPolicyDeclaredNativePurposeRule(rule = {}) {
  return DECLARED_NATIVE_SOURCE_IDS.has(rule?.source);
}

/** Classifies one rule without returning its values or other content. */
export function classifyPolicyDeclaredPurposeRuleProvenance(rule = {}) {
  if (isPolicyProfileDerivedPurposeRule(rule)) {
    return POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.PROFILE_DERIVED;
  }
  if (isPolicyDeclaredNativePurposeRule(rule)) {
    return POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.DECLARED_NATIVE;
  }
  return POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.UNVERIFIED;
}

/** Builds a static SQL predicate for profile-derived purpose evidence. */
export function buildPolicyProfileDerivedPurposeRuleSqlPredicate({ ruleAlias = 'rule' } = {}) {
  const alias = sqlAlias(ruleAlias, 'rule');
  return `${alias}.source = 'media_server_library_profile'
             AND ${alias}.inference_state = 'inferred'`;
}

/** Builds a static SQL predicate for server-recorded native declarations. */
export function buildPolicyDeclaredNativePurposeRuleSqlPredicate({ ruleAlias = 'rule' } = {}) {
  const alias = sqlAlias(ruleAlias, 'rule');
  return `${alias}.source IN ('native_intent', 'operator_declared_intent')`;
}
