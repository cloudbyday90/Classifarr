/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { isHeldOutSemanticStudyExcludedInferredProfileRule } from './heldOutSemanticStudyPolicySourceRule.mjs';

export const HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS = Object.freeze({
  NO_OBSERVED_PURPOSE: 'no_observed_purpose',
  PROFILE_ONLY_PURPOSE: 'profile_only_purpose',
  RETAINED_DECLARED_PURPOSE: 'retained_declared_purpose',
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
  const excludedInferredProfilePurposeRuleCount = observedPurposeRules.filter(
    isHeldOutSemanticStudyExcludedInferredProfileRule,
  ).length;
  const retainedPurposeRuleCount = observedPurposeRules.length -
    excludedInferredProfilePurposeRuleCount;
  const id = observedPurposeRules.length === 0
    ? HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.NO_OBSERVED_PURPOSE
    : retainedPurposeRuleCount === 0
      ? HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.PROFILE_ONLY_PURPOSE
      : HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_DISPOSITION_IDS.RETAINED_DECLARED_PURPOSE;

  return Object.freeze({
    excludedInferredProfilePurposeRuleCount,
    id,
    observedPurposeRuleCount: observedPurposeRules.length,
    retainedPurposeRuleCount,
  });
}
