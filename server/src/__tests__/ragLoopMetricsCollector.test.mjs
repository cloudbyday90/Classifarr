/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ragLoopMetricsCollector } from '../services/ragLoopMetricsCollector.mjs';

describe('ragLoopMetricsCollector', () => {
    beforeEach(() => {
        ragLoopMetricsCollector.reset();
    });

    test('tracks shadow/apply metrics and computes snapshot', () => {
        ragLoopMetricsCollector.recordEvaluation({
            rolloutMode: 'shadow',
            wouldUpgrade: true,
            adopted: false,
            hadError: false,
            latencyDeltaMs: 120
        });
        ragLoopMetricsCollector.recordEvaluation({
            rolloutMode: 'shadow',
            wouldUpgrade: false,
            adopted: false,
            hadError: true,
            latencyDeltaMs: 200
        });
        ragLoopMetricsCollector.recordEvaluation({
            rolloutMode: 'apply',
            wouldUpgrade: false,
            adopted: true,
            hadError: false,
            latencyDeltaMs: 80
        });

        const snapshot = ragLoopMetricsCollector.getSnapshot();
        expect(snapshot.shadow_sample_count).toBe(2);
        expect(snapshot.apply_sample_count).toBe(1);
        expect(snapshot.apply_upgrade_count).toBe(1);
        expect(snapshot.apply_error_rate_delta).toBe(0);
        expect(snapshot.shadow_error_rate_delta).toBe(0.5);
        expect(snapshot.correction_delta).toBe(0.5);
        expect(snapshot.error_rate_delta).toBeCloseTo(1 / 3, 5);
        expect(snapshot.apply_p95_latency_delta_ms).toBe(80);
        expect(snapshot.shadow_p95_latency_delta_ms).toBe(200);
        expect(snapshot.p95_latency_delta_ms).toBe(200);
    });

    test('promotion readiness honors configured gates', () => {
        for (let i = 0; i < 3; i += 1) {
            ragLoopMetricsCollector.recordEvaluation({
                rolloutMode: 'shadow',
                wouldUpgrade: i % 2 === 0,
                hadError: false,
                latencyDeltaMs: 100 + i
            });
        }

        const gate = ragLoopMetricsCollector.canPromote({
            rag_loop_shadow_min_samples: 3,
            rag_loop_shadow_max_error_rate_delta: 0.1,
            rag_loop_shadow_max_p95_latency_delta_ms: 200
        });

        expect(gate.ready).toBe(true);
        expect(gate.metrics.shadow_sample_count).toBe(3);
    });

    test('auto-fallback evaluation respects min-samples and consecutive breaches', () => {
        ragLoopMetricsCollector.recordEvaluation({
            rolloutMode: 'apply',
            hadError: true,
            latencyDeltaMs: 300
        });

        let evaluation = ragLoopMetricsCollector.evaluateAutoFallback({
            config: {
                rag_loop_auto_fallback_enabled: true,
                rag_loop_auto_fallback_min_apply_samples: 2,
                rag_loop_auto_fallback_consecutive_breaches: 2,
                rag_loop_auto_fallback_cooldown_ms: 900000,
                rag_loop_shadow_max_error_rate_delta: 0.01,
                rag_loop_shadow_max_p95_latency_delta_ms: 250
            },
            state: {
                breachCount: 0,
                cooldownUntil: null
            }
        });

        expect(evaluation.minSamplesReached).toBe(false);
        expect(evaluation.shouldFallback).toBe(false);
        expect(evaluation.nextBreachCount).toBe(0);

        ragLoopMetricsCollector.recordEvaluation({
            rolloutMode: 'apply',
            hadError: true,
            latencyDeltaMs: 300
        });

        evaluation = ragLoopMetricsCollector.evaluateAutoFallback({
            config: {
                rag_loop_auto_fallback_enabled: true,
                rag_loop_auto_fallback_min_apply_samples: 2,
                rag_loop_auto_fallback_consecutive_breaches: 2,
                rag_loop_auto_fallback_cooldown_ms: 900000,
                rag_loop_shadow_max_error_rate_delta: 0.01,
                rag_loop_shadow_max_p95_latency_delta_ms: 250
            },
            state: {
                breachCount: 1,
                cooldownUntil: null
            }
        });

        expect(evaluation.minSamplesReached).toBe(true);
        expect(evaluation.breachDetected).toBe(true);
        expect(evaluation.nextBreachCount).toBe(2);
        expect(evaluation.shouldFallback).toBe(true);
        expect(evaluation.breachReasonCodes).toContain('error_rate_delta_exceeded');
        expect(evaluation.breachReasonCodes).toContain('p95_latency_delta_exceeded');
    });

    test('auto-fallback evaluation enforces cooldown and no-flap behavior', () => {
        ragLoopMetricsCollector.recordEvaluation({
            rolloutMode: 'apply',
            hadError: true,
            latencyDeltaMs: 400
        });

        const futureCooldown = new Date(Date.now() + 60000).toISOString();
        const evaluation = ragLoopMetricsCollector.evaluateAutoFallback({
            config: {
                rag_loop_auto_fallback_enabled: true,
                rag_loop_auto_fallback_min_apply_samples: 1,
                rag_loop_auto_fallback_consecutive_breaches: 1,
                rag_loop_auto_fallback_cooldown_ms: 900000,
                rag_loop_shadow_max_error_rate_delta: 0.01,
                rag_loop_shadow_max_p95_latency_delta_ms: 250
            },
            state: {
                breachCount: 5,
                cooldownUntil: futureCooldown
            }
        });

        expect(evaluation.inCooldown).toBe(true);
        expect(evaluation.shouldFallback).toBe(false);
        expect(evaluation.nextBreachCount).toBe(5);
    });

    test('auto-recover stays disabled by default and only allows one version-bump attempt', () => {
        let decision = ragLoopMetricsCollector.shouldAttemptAutoRecover({
            config: {
                rag_loop_auto_recover_enabled: false
            },
            state: {
                lastFallbackVersion: '0.41.2-alpha',
                lastRecoverAttemptVersion: null
            },
            currentVersion: '0.41.3-alpha',
            rolloutMode: 'shadow'
        });
        expect(decision.shouldRecover).toBe(false);

        decision = ragLoopMetricsCollector.shouldAttemptAutoRecover({
            config: {
                rag_loop_auto_recover_enabled: true
            },
            state: {
                lastFallbackVersion: '0.41.2-alpha',
                lastRecoverAttemptVersion: null
            },
            currentVersion: '0.41.3-alpha',
            rolloutMode: 'shadow'
        });
        expect(decision.shouldRecover).toBe(true);

        decision = ragLoopMetricsCollector.shouldAttemptAutoRecover({
            config: {
                rag_loop_auto_recover_enabled: true
            },
            state: {
                lastFallbackVersion: '0.41.2-alpha',
                lastRecoverAttemptVersion: '0.41.3-alpha'
            },
            currentVersion: '0.41.3-alpha',
            rolloutMode: 'shadow'
        });
        expect(decision.shouldRecover).toBe(false);
        expect(decision.reason).toBe('already_attempted_this_version');
    });
});
