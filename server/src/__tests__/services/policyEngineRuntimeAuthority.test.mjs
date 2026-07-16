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
  hasAttachedNativePolicyIntent,
  isNativePolicyRuntimeAuthority,
  withPolicyEngineRuntimeAuthority,
} from '../../services/policyEngineRuntimeAuthority.mjs';

function nativePolicy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    presets: [{ custom_signals: { genres: { require_any: ['Horror'] } } }],
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
        }],
        hard_limits: [],
        helpful_hints: [],
        avoid: [],
        review_behavior: {
          auto_classify_threshold: 90,
          prompt_threshold: 70,
          trust_rag: false,
        },
        template_links: [],
        warnings: [],
        unsupported_signals: [],
      },
    },
    ...overrides,
  };
}

describe('policyEngineRuntimeAuthority', () => {
  test('uses native review behavior and suppresses legacy presets for converted policies', () => {
    const policy = withPolicyEngineRuntimeAuthority(nativePolicy());

    expect(isNativePolicyRuntimeAuthority(policy)).toBe(true);
    expect(policy.presets).toEqual([]);
    expect(policy.auto_classify_threshold).toBe(90);
    expect(policy.prompt_threshold).toBe(70);
    expect(policy.trust_rag).toBe(false);
    expect(policy.policy_runtime_authority).toEqual(expect.objectContaining({
      sourceId: 'native_intent',
      statusId: 'native_intent_active',
      dependsOnCustomSignals: false,
      validationOk: true,
    }));
  });

  test('keeps an authority conflict native and never resumes legacy preset scoring', () => {
    const policy = withPolicyEngineRuntimeAuthority(nativePolicy({
      native_intent: undefined,
      native_intent_authority: {
        stateId: 'ambiguous_active_native_intents',
        activeIntentCount: 2,
      },
    }));

    expect(hasAttachedNativePolicyIntent(policy)).toBe(true);
    expect(policy.presets).toEqual([]);
    expect(policy.policy_runtime_authority).toEqual(expect.objectContaining({
      sourceId: 'native_intent',
      statusId: 'native_intent_authority_conflict',
      validationOk: false,
    }));
  });

  test('keeps unconverted policies on the compatibility branch', () => {
    const policy = withPolicyEngineRuntimeAuthority({
      id: 15,
      library_id: 4,
      presets: [{ id: 7 }],
    });

    expect(isNativePolicyRuntimeAuthority(policy)).toBe(false);
    expect(policy.presets).toHaveLength(1);
    expect(policy.policy_runtime_authority.sourceId).toBe('compatibility_bridge');
  });
});
