/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  buildHeldOutSemanticStudyPolicySourceScreen,
  HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS,
  HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_VERSION,
  isHeldOutSemanticStudyExcludedInferredProfileRule,
} from '../../services/heldOutSemanticStudyPolicySourceScreen.mjs';

test('excludes only inferred media-server profile rules from the held-out study boundary', () => {
  const screen = buildHeldOutSemanticStudyPolicySourceScreen({
    policies: [{
      id: 7,
      policy_intent_contract: {
        purpose: [
          {
            source: 'media_server_library_profile',
            inference_state: 'inferred',
            values: { require_any: ['private-profile-value'] },
          },
          {
            source: 'operator_declared_intent',
            inference_state: 'inferred',
            values: { require_any: ['private-declared-value'] },
          },
          {
            source: 'media_server_library_profile',
            inference_state: 'partial',
            values: { require_any: ['private-partial-value'] },
          },
        ],
      },
    }],
  });

  expect(isHeldOutSemanticStudyExcludedInferredProfileRule({
    source: 'media_server_library_profile', inference_state: 'inferred',
  })).toBe(true);
  expect(isHeldOutSemanticStudyExcludedInferredProfileRule({
    source: 'operator_declared_intent', inference_state: 'inferred',
  })).toBe(false);
  expect(screen).toEqual({
    activePolicyCount: 1,
    excludedInferredProfilePurposeRuleCount: 1,
    policyWithObservedPurposeCount: 1,
    profileOnlyPurposePolicyCount: 0,
    policyPurposeDispositionCounts: {
      no_observed_purpose: 0,
      profile_only_purpose: 0,
      retained_declared_purpose: 1,
    },
    policyWithRetainedPurposeCount: 1,
    policyWithoutObservedPurposeCount: 0,
    policyWithoutRetainedPurposeCount: 0,
    observedPurposeRuleCount: 3,
    rawConfigurationExposed: false,
    retainedPurposeRuleCount: 2,
    statusId: HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS
      .RETAINED_PURPOSE_RULES_AVAILABLE,
    version: HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_VERSION,
  });
  expect(JSON.stringify(screen)).not.toMatch(/private|values|id/u);
});

test('reports when the audit excludes every declared purpose rule as observed profile evidence', () => {
  expect(buildHeldOutSemanticStudyPolicySourceScreen({
    policies: [{ policy_intent_contract: { purpose: [{
      source: 'media_server_library_profile', inference_state: 'inferred',
    }] } }],
  })).toEqual(expect.objectContaining({
    excludedInferredProfilePurposeRuleCount: 1,
    policyWithObservedPurposeCount: 1,
    profileOnlyPurposePolicyCount: 1,
    policyPurposeDispositionCounts: {
      no_observed_purpose: 0,
      profile_only_purpose: 1,
      retained_declared_purpose: 0,
    },
    policyWithRetainedPurposeCount: 0,
    policyWithoutObservedPurposeCount: 0,
    policyWithoutRetainedPurposeCount: 1,
    observedPurposeRuleCount: 1,
    retainedPurposeRuleCount: 0,
    statusId: HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS
      .ALL_PURPOSE_RULES_EXCLUDED_AS_INFERRED_PROFILE,
  }));
});

test('keeps absent, profile-only, and retained policy evidence mutually exclusive', () => {
  const screen = buildHeldOutSemanticStudyPolicySourceScreen({
    policies: [
      { policy_intent_contract: { purpose: [] } },
      { policy_intent_contract: { purpose: [{
        source: 'media_server_library_profile', inference_state: 'inferred',
      }] } },
      { policy_intent_contract: { purpose: [{
        source: 'operator_declared_intent', inference_state: 'inferred',
      }] } },
    ],
  });

  expect(screen).toEqual(expect.objectContaining({
    activePolicyCount: 3,
    policyWithoutObservedPurposeCount: 1,
    profileOnlyPurposePolicyCount: 1,
    policyWithRetainedPurposeCount: 1,
    policyPurposeDispositionCounts: {
      no_observed_purpose: 1,
      profile_only_purpose: 1,
      retained_declared_purpose: 1,
    },
    policyWithObservedPurposeCount: 2,
    policyWithoutRetainedPurposeCount: 2,
    observedPurposeRuleCount: 2,
    excludedInferredProfilePurposeRuleCount: 1,
    retainedPurposeRuleCount: 1,
    statusId: HELD_OUT_SEMANTIC_STUDY_POLICY_SOURCE_SCREEN_STATUS_IDS
      .RETAINED_PURPOSE_RULES_AVAILABLE,
  }));
});
