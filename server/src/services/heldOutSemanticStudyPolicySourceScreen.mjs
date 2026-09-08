/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  classifyHeldOutSemanticStudyPolicySourceDisposition,
  HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS,
} from './heldOutSemanticStudyPolicySourceDisposition.mjs';
import { isHeldOutSemanticStudyExcludedInferredProfileRule } from './heldOutSemanticStudyPolicySourceRule.mjs';

export const HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS = Object.freeze({
  ALL_PURPOSE_RULES_EXCLUDED_AS_INFERRED_PROFILE:
    'all_purpose_rules_excluded_as_inferred_profile',
  NO_OBSERVED_PURPOSE_RULES: 'no_observed_purpose_rules',
  RETAINED_PURPOSE_RULES_AVAILABLE: 'retained_purpose_rules_available',
});

export const HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_VERSION =
  'policy.held_out_semantic_study_policy_source_screen.v3';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export { isHeldOutSemanticStudyExcludedInferredProfileRule };

function fixedDispositionCounts() {
  return Object.fromEntries(Object.values(
    HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS,
  ).map((id) => [id, 0]));
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
  const policyPurposeDispositionCounts = fixedDispositionCounts();
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
    const disposition = classifyHeldOutSemanticStudyPolicySourceDisposition({
      purposeRules: policy?.policy_intent_contract?.purpose,
    });
    policyPurposeDispositionCounts[disposition.id] += 1;
    summary.excludedInferredProfilePurposeRuleCount +=
      disposition.excludedInferredProfilePurposeRuleCount;
    summary.observedPurposeRuleCount += disposition.observedPurposeRuleCount;
    summary.retainedPurposeRuleCount += disposition.retainedPurposeRuleCount;
    if (disposition.id === HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.NO_OBSERVED_PURPOSE) {
      summary.policyWithoutObservedPurposeCount += 1;
      continue;
    }
    summary.policyWithObservedPurposeCount += 1;
    if (disposition.id === HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.RETAINED_DECLARED_PURPOSE) {
      summary.policyWithRetainedPurposeCount += 1;
    } else {
      summary.profileOnlyPurposePolicyCount += 1;
    }
  }

  return Object.freeze({
    version: HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_VERSION,
    ...summary,
    policyPurposeDispositionCounts: Object.freeze(policyPurposeDispositionCounts),
    policyWithoutRetainedPurposeCount: summary.activePolicyCount - summary.policyWithRetainedPurposeCount,
    rawConfigurationExposed: false,
    statusId: statusId(summary),
  });
}
