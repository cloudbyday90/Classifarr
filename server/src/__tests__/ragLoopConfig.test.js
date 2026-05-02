/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const {
    RAG_LOOP_V1_KEYS,
    getRagLoopDefaultConfig,
    resolveRagLoopEffectiveConfig,
    validateAndNormalizeRagLoopConfig
} = require('../utils/ragLoopConfig');

describe('ragLoopConfig', () => {
    test('returns full default config for all RAG loop keys', () => {
        const defaults = getRagLoopDefaultConfig();

        expect(Object.keys(defaults).sort()).toEqual([...RAG_LOOP_V1_KEYS].sort());
        expect(defaults.rag_loop_rollout_mode).toBe('apply');
        expect(defaults.rag_loop_auto_fallback_enabled).toBe(true);
        expect(defaults.rag_loop_auto_fallback_min_apply_samples).toBe(25);
        expect(defaults.rag_loop_auto_fallback_consecutive_breaches).toBe(3);
        expect(defaults.rag_loop_auto_recover_enabled).toBe(false);
        expect(defaults.policy_recheck_identifier_caps).toEqual({
            keywords: 8,
            genres: 5,
            studios: 3,
            cast: 3
        });
        expect(defaults.policy_recheck_confidence_gain_multiplier).toBe(2);
    });

    test('normalizes invalid/raw values into deterministic safe values', () => {
        const { normalizedConfig, warnings } = validateAndNormalizeRagLoopConfig({
            rag_loop_rollout_mode: 'invalid',
            rag_loop_low_confidence_threshold: 999,
            rag_retry_strategy: 'invalid',
            rag_retry_low_signal_similarity_floor: -2,
            policy_recheck_confidence_gain_multiplier: 99,
            policy_recheck_identifier_caps: {
                keywords: 999,
                genres: 'abc',
                cast: -1,
                studios: 2
            },
            rag_loop_trace_max_bytes: '200000',
            rag_loop_resilience_timeout_rate_threshold: '1.7',
            rag_loop_auto_fallback_min_apply_samples: -10,
            rag_loop_auto_fallback_consecutive_breaches: 999,
            rag_loop_auto_fallback_cooldown_ms: '999999999'
        });

        expect(normalizedConfig.rag_loop_rollout_mode).toBe('apply');
        expect(normalizedConfig.rag_loop_low_confidence_threshold).toBe(100);
        expect(normalizedConfig.rag_retry_strategy).toBe('auto');
        expect(normalizedConfig.rag_retry_low_signal_similarity_floor).toBe(0);
        expect(normalizedConfig.policy_recheck_identifier_caps).toEqual({
            keywords: 25,
            genres: 5,
            studios: 2,
            cast: 0
        });
        expect(normalizedConfig.rag_loop_trace_max_bytes).toBe(131072);
        expect(normalizedConfig.rag_loop_resilience_timeout_rate_threshold).toBe(1);
        expect(normalizedConfig.rag_loop_auto_fallback_min_apply_samples).toBe(1);
        expect(normalizedConfig.rag_loop_auto_fallback_consecutive_breaches).toBe(100);
        expect(normalizedConfig.rag_loop_auto_fallback_cooldown_ms).toBe(86400000);
        expect(normalizedConfig.policy_recheck_confidence_gain_multiplier).toBe(10); // clamped from 99
        expect(warnings.length).toBeGreaterThan(0);
    });

    test('uses existing values for omitted keys in partial updates', () => {
        const existing = {
            rag_loop_rollout_mode: 'apply',
            rag_loop_low_confidence_threshold: 65,
            policy_recheck_identifier_caps: {
                keywords: 5,
                genres: 4,
                studios: 3,
                cast: 2
            }
        };

        const { normalizedConfig } = validateAndNormalizeRagLoopConfig(
            { rag_loop_low_confidence_threshold: 70 },
            existing
        );

        expect(normalizedConfig.rag_loop_rollout_mode).toBe('apply');
        expect(normalizedConfig.rag_loop_low_confidence_threshold).toBe(70);
        expect(normalizedConfig.policy_recheck_identifier_caps).toEqual(existing.policy_recheck_identifier_caps);
    });

    test('resolves effective config as global-only in V1 with source tags', () => {
        const { effectiveConfig, sourceMap } = resolveRagLoopEffectiveConfig({
            globalConfig: {
                rag_loop_rollout_mode: 'apply',
                rag_loop_low_confidence_threshold: 72
            },
            policyOverride: {
                enabled: true,
                second_pass_enabled: false
            },
            enablePolicyOverrides: false
        });

        expect(effectiveConfig.rag_loop_rollout_mode).toBe('apply');
        expect(effectiveConfig.rag_loop_low_confidence_threshold).toBe(72);
        expect(sourceMap.rag_loop_rollout_mode).toBe('global');
        expect(sourceMap.rag_loop_low_confidence_threshold).toBe('global');
    });
});
