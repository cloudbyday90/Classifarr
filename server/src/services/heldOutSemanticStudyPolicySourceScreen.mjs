/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS = Object.freeze({
  ALL_PURPOSE_RULES_EXCLUDED_AS_INFERRED_PROFILE:
    'all_purpose_rules_excluded_as_inferred_profile',
  NO_OBSERVED_PURPOSE_RULES: 'no_observed_purpose_rules',
  RETAINED_PURPOSE_RULES_AVAILABLE: 'retained_purpose_rules_available',
});

export const HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_VERSION =
  'policy.held_out_semantic_study_policy_source_screen.v2';

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

function statusId({ observedPurposeRuleCount, retainedPurposeRuleCount }) {
  if (observedPurposeRuleCount === 0) {
    return HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS.NO_OBSERVED_PURPOSE_RULES;
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
    policyWithObservedPurposeCount: 0,
    profileOnlyPurposePolicyCount: 0,
    policyWithRetainedPurposeCount: 0,
    policyWithoutObservedPurposeCount: 0,
    observedPurposeRuleCount: 0,
    retainedPurposeRuleCount: 0,
  };

  for (const policy of asArray(policies)) {
    summary.activePolicyCount += 1;
    const purposeRules = asArray(policy?.policy_intent_contract?.purpose);
    summary.observedPurposeRuleCount += purposeRules.length;
    if (purposeRules.length === 0) {
      summary.policyWithoutObservedPurposeCount += 1;
      continue;
    }
    summary.policyWithObservedPurposeCount += 1;

    const retainedPurposeRules = purposeRules.filter((rule) => {
      if (!isHeldOutSemanticStudyExcludedInferredProfileRule(rule)) return true;
      summary.excludedInferredProfilePurposeRuleCount += 1;
      return false;
    });
    summary.retainedPurposeRuleCount += retainedPurposeRules.length;
    if (retainedPurposeRules.length > 0) {
      summary.policyWithRetainedPurposeCount += 1;
    } else {
      summary.profileOnlyPurposePolicyCount += 1;
    }
  }

  return Object.freeze({
    version: HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_VERSION,
    ...summary,
    policyWithoutRetainedPurposeCount: summary.activePolicyCount - summary.policyWithRetainedPurposeCount,
    rawConfigurationExposed: false,
    statusId: statusId(summary),
  });
}
