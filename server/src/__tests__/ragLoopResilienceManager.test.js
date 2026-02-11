/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const { RagLoopResilienceManager, STATES } = require('../services/ragLoopResilienceManager');

function makeTimeoutError(message = 'timeout') {
    const error = new Error(message);
    error.code = 'ETIMEDOUT';
    return error;
}

describe('ragLoopResilienceManager', () => {
    let now;
    let manager;
    let config;

    beforeEach(() => {
        now = 1_000;
        manager = new RagLoopResilienceManager(() => now);
        config = {
            rag_loop_resilience_enabled: true,
            rag_loop_resilience_window_ms: 60_000,
            rag_loop_resilience_min_samples: 3,
            rag_loop_resilience_timeout_streak_threshold: 2,
            rag_loop_resilience_timeout_rate_threshold: 0.5,
            rag_loop_resilience_error_rate_threshold: 0.6,
            rag_loop_cooldown_tmdb_ms: 1_000,
            rag_loop_cooldown_rag_ms: 1_000,
            rag_loop_cooldown_ai_ms: 1_000,
            rag_loop_half_open_probe_count: 2,
            rag_loop_global_bypass_multi_open_enabled: true,
            rag_loop_global_bypass_ms: 2_000
        };
    });

    test('opens only after minimum sample gate is met', () => {
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);

        let status = manager.getDiagnostics().scopes.rag_pass2;
        expect(status.state).toBe(STATES.CLOSED);

        manager.recordFailure('rag_pass2', makeTimeoutError(), config);
        status = manager.getDiagnostics().scopes.rag_pass2;
        expect(status.state).toBe(STATES.OPEN);
    });

    test('open breaker skips only the scoped dependency stage', () => {
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);

        const ragGate = manager.canRun('rag_pass2', config);
        const tmdbGate = manager.canRun('tmdb_enrichment', config);

        expect(ragGate.allowed).toBe(false);
        expect(ragGate.reasonCode).toBe('rag_pass2_cooldown');
        expect(tmdbGate.allowed).toBe(true);
    });

    test('half-open probes recover on sustained success and reopen on failure', () => {
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);

        now += 1_100;
        let gate = manager.canRun('rag_pass2', config);
        expect(gate.allowed).toBe(true);
        expect(gate.state).toBe(STATES.HALF_OPEN);
        manager.recordFailure('rag_pass2', new Error('probe failed'), config);

        let status = manager.getDiagnostics().scopes.rag_pass2;
        expect(status.state).toBe(STATES.OPEN);

        now += 1_100;
        gate = manager.canRun('rag_pass2', config);
        expect(gate.allowed).toBe(true);
        manager.recordSuccess('rag_pass2', config);

        gate = manager.canRun('rag_pass2', config);
        expect(gate.allowed).toBe(true);
        manager.recordSuccess('rag_pass2', config);

        status = manager.getDiagnostics().scopes.rag_pass2;
        expect(status.state).toBe(STATES.CLOSED);
    });

    test('activates global bypass when multiple scoped breakers are open', () => {
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);
        manager.recordFailure('rag_pass2', makeTimeoutError(), config);

        manager.recordFailure('ai_rerun', makeTimeoutError(), config);
        manager.recordFailure('ai_rerun', makeTimeoutError(), config);
        manager.recordFailure('ai_rerun', makeTimeoutError(), config);

        const gate = manager.canRun('tmdb_enrichment', config);
        expect(gate.allowed).toBe(false);
        expect(gate.reasonCode).toBe('global_bypass_active');
    });
});
