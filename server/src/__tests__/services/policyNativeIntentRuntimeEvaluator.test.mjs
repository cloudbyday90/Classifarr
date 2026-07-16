/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS,
  evaluateNativePolicyIntent,
} from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { withPolicyEngineRuntimeAuthority } from '../../services/policyEngineRuntimeAuthority.mjs';

function policy(overrides = {}) {
  return withPolicyEngineRuntimeAuthority({
    id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    presets: [{ signals: { genres: { require_any: ['Horror'] } } }],
    native_intent: {
      active: true,
      intent_version: 2,
      contract: {
        schema_version: 1,
        policy_id: 14,
        library_id: 4,
        library_name: 'Animated Movies',
        library_media_type: 'movie',
        source: 'native_intent',
        inference_state: 'inferred',
        model: { mode: 'native_intent', intent_supported: true, native_intent: true },
        purpose: [{
          intent_role: 'purpose',
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['Animation'] },
          semantics: 'identity',
          constraint_mode: 'advisory',
        }],
        hard_limits: [],
        helpful_hints: [],
        avoid: [],
        review_behavior: {},
        template_links: [],
        warnings: [],
        unsupported_signals: [],
      },
    },
    ...overrides,
  });
}

describe('policyNativeIntentRuntimeEvaluator', () => {
  test('uses native purpose rules and ignores retained legacy preset signals', () => {
    expect(evaluateNativePolicyIntent(policy(), {
      genres: ['Animation'], media_type: 'movie',
    })).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.ACTIVE,
      eligible: true,
      purposeScore: 80,
    }));

    expect(evaluateNativePolicyIntent(policy(), {
      genres: ['Horror'], media_type: 'movie',
    })).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.PURPOSE_NOT_MATCHED,
      eligible: false,
      score: 0,
    }));
  });

  test('fails closed for failed or unknown native hard limits', () => {
    const constrainedPolicy = policy();
    constrainedPolicy.policy_intent_contract.hard_limits = [{
      intent_role: 'hard_limit',
      signal_type: 'certifications',
      operator: 'max',
      values: { mode: 'max', max: 'PG-13' },
      constraint_mode: 'strict',
    }];

    expect(evaluateNativePolicyIntent(constrainedPolicy, {
      genres: ['Animation'], certification: 'R', media_type: 'movie',
    }).statusId).toBe(POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_FAILED);
    expect(evaluateNativePolicyIntent(constrainedPolicy, {
      genres: ['Animation'], media_type: 'movie',
    }).statusId).toBe(POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_UNKNOWN);
  });

  test('never lets helpful hints establish identity by themselves', () => {
    const helpfulOnlyPolicy = policy();
    helpfulOnlyPolicy.policy_intent_contract.purpose = [];
    helpfulOnlyPolicy.policy_intent_contract.helpful_hints = [{
      intent_role: 'helpful_hint',
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Comedy'] },
      semantics: 'compatibility',
    }];

    expect(evaluateNativePolicyIntent(helpfulOnlyPolicy, {
      genres: ['Comedy'], media_type: 'movie',
    })).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.NO_PURPOSE,
      eligible: false,
      score: 0,
    }));
  });

  test('penalizes only an explicit avoid match and keeps missing avoid metadata neutral', () => {
    const avoidPolicy = policy();
    avoidPolicy.policy_intent_contract.avoid = [{
      intent_role: 'avoid',
      signal_type: 'certifications',
      operator: 'exclude',
      values: { mode: 'exclude', exclude: ['R'] },
      constraint_mode: 'advisory',
    }];

    expect(evaluateNativePolicyIntent(avoidPolicy, {
      genres: ['Animation'], certification: 'R', media_type: 'movie',
    })).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.ACTIVE,
      score: 65,
      avoidPenalty: 15,
    }));

    expect(evaluateNativePolicyIntent(avoidPolicy, {
      genres: ['Animation'], media_type: 'movie',
    })).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.ACTIVE,
      score: 80,
      avoidPenalty: 0,
    }));
  });
});
