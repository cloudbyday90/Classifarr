/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS = Object.freeze({
  ALL_PURPOSE_RULES_EXCLUDED_AS_INFERRED_PROFILE:
    'all_purpose_rules_excluded_as_inferred_profile',
  NO_DECLARED_PURPOSE_RULES: 'no_declared_purpose_rules',
  RETAINED_PURPOSE_RULES_AVAILABLE: 'retained_purpose_rules_available',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * The study excludes only observed profile rules that were inferred from a
 * destination's existing contents. Contract-level inference alone is not a
 * profile provenance signal: operator-declared native rules also use it.
 */
export function isHeldOutSemanticStudyExcludedInferredProfileRule(rule = {}) {
  return rule?.source === 'media_server_library_profile' &&
    rule?.inference_state === 'inferred';
}

function statusId({ purposeRuleCount, retainedPurposeRuleCount }) {
  if (purposeRuleCount === 0) {
    return HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS.NO_DECLARED_PURPOSE_RULES;
  }
  if (retainedPurposeRuleCount === 0) {
    return HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS
      .ALL_PURPOSE_RULES_EXCLUDED_AS_INFERRED_PROFILE;
  }
  return HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS
    .RETAINED_PURPOSE_RULES_AVAILABLE;
}

/**
 * Redacts active-policy purpose provenance to fixed aggregate counts. It is
 * diagnostic-only and never returns policy identities, rule values, or media.
 */
export function buildHeldOutSemanticStudyPolicySourceScreen({ policies = [] } = {}) {
  const summary = {
    activePolicyCount: 0,
    excludedInferredProfilePurposeRuleCount: 0,
    policyWithDeclaredPurposeCount: 0,
    policyWithRetainedPurposeCount: 0,
    purposeRuleCount: 0,
    retainedPurposeRuleCount: 0,
  };

  for (const policy of asArray(policies)) {
    summary.activePolicyCount += 1;
    const purposeRules = asArray(policy?.policy_intent_contract?.purpose);
    summary.purposeRuleCount += purposeRules.length;
    if (purposeRules.length > 0) summary.policyWithDeclaredPurposeCount += 1;

    const retainedPurposeRules = purposeRules.filter((rule) => {
      if (!isHeldOutSemanticStudyExcludedInferredProfileRule(rule)) return true;
      summary.excludedInferredProfilePurposeRuleCount += 1;
      return false;
    });
    summary.retainedPurposeRuleCount += retainedPurposeRules.length;
    if (retainedPurposeRules.length > 0) summary.policyWithRetainedPurposeCount += 1;
  }

  return Object.freeze({
    ...summary,
    policyWithoutRetainedPurposeCount: summary.activePolicyCount - summary.policyWithRetainedPurposeCount,
    rawConfigurationExposed: false,
    statusId: statusId(summary),
  });
}
