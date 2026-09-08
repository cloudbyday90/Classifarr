/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  classifyPolicyDeclaredPurposeRuleProvenance,
  POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS,
} from './policyDeclaredPurposeProvenance.mjs';

export const HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS = Object.freeze({
  NO_OBSERVED_PURPOSE: 'no_observed_purpose',
  PROFILE_ONLY_PURPOSE: 'profile_only_purpose',
  RETAINED_DECLARED_PURPOSE: 'retained_declared_purpose',
  UNVERIFIED_PURPOSE_SOURCE: 'unverified_purpose_source',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Classifies one policy into exactly one content-free study-source
 * disposition. Rule values, identities, and configuration do not leave this
 * in-memory boundary.
 */
export function classifyHeldOutSemanticStudyPolicySourceDisposition({ purposeRules } = {}) {
  const observedPurposeRules = asArray(purposeRules);
  const provenanceCounts = observedPurposeRules.reduce((counts, rule) => {
    counts[classifyPolicyDeclaredPurposeRuleProvenance(rule)] += 1;
    return counts;
  }, {
    [POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.DECLARED_NATIVE]: 0,
    [POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.PROFILE_DERIVED]: 0,
    [POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.UNVERIFIED]: 0,
  });
  const declaredNativePurposeRuleCount = provenanceCounts[
    POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.DECLARED_NATIVE
  ];
  const excludedInferredProfilePurposeRuleCount = provenanceCounts[
    POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.PROFILE_DERIVED
  ];
  const unverifiedPurposeRuleCount = provenanceCounts[
    POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.UNVERIFIED
  ];
  const id = observedPurposeRules.length === 0
    ? HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.NO_OBSERVED_PURPOSE
    : declaredNativePurposeRuleCount > 0
      ? HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.RETAINED_DECLARED_PURPOSE
      : unverifiedPurposeRuleCount > 0
        ? HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.UNVERIFIED_PURPOSE_SOURCE
        : excludedInferredProfilePurposeRuleCount > 0
      ? HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.PROFILE_ONLY_PURPOSE
      : HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.UNVERIFIED_PURPOSE_SOURCE;

  return Object.freeze({
    declaredNativePurposeRuleCount,
    excludedInferredProfilePurposeRuleCount,
    id,
    observedPurposeRuleCount: observedPurposeRules.length,
    retainedPurposeRuleCount: declaredNativePurposeRuleCount,
    unverifiedPurposeRuleCount,
  });
}
