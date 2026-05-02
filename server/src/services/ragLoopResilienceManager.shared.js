/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('RagLoopResilience');

const STATES = Object.freeze({
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
});

const SCOPES = Object.freeze(['tmdb_enrichment', 'rag_pass2', 'ai_rerun']);

const STAGE_FALLBACKS = Object.freeze({
    tmdb_enrichment: 'enrichment_skipped',
    rag_pass2: 'pass2_skipped',
    ai_rerun: 'ai_rerun_skipped'
});

class RagLoopResilienceManager {
    constructor(nowFn = () => Date.now()) {
        this.nowFn = nowFn;
        this.reset();
    }

    createScopeState() {
        return {
            state: STATES.CLOSED,
            events: [],
            openedAt: null,
            openUntil: null,
            halfOpenRemaining: 0,
            halfOpenSuccesses: 0,
            lastReason: 'initialized',
            lastTransitionAt: this.nowFn(),
            history: [{
                from: null,
                to: STATES.CLOSED,
                reason: 'initialized',
                timestamp: this.nowFn()
            }]
        };
    }

    reset() {
        this.globalBypassUntil = null;
        this.globalBypassReason = null;
        this.scopes = {};
        for (const scope of SCOPES) {
            this.scopes[scope] = this.createScopeState();
        }
    }

    resolveConfig(raw = {}) {
        const toNumber = (value, fallback) => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : fallback;
        };
        const toBool = (value, fallback = false) => (typeof value === 'boolean' ? value : fallback);

        return {
            enabled: toBool(raw.rag_loop_resilience_enabled, true),
            windowMs: Math.max(1000, toNumber(raw.rag_loop_resilience_window_ms, 300000)),
            minSamples: Math.max(1, toNumber(raw.rag_loop_resilience_min_samples, 20)),
            timeoutStreakThreshold: Math.max(1, toNumber(raw.rag_loop_resilience_timeout_streak_threshold, 3)),
            timeoutRateThreshold: Math.min(1, Math.max(0, toNumber(raw.rag_loop_resilience_timeout_rate_threshold, 0.35))),
            errorRateThreshold: Math.min(1, Math.max(0, toNumber(raw.rag_loop_resilience_error_rate_threshold, 0.5))),
            cooldownTmdbMs: Math.max(0, toNumber(raw.rag_loop_cooldown_tmdb_ms, 900000)),
            cooldownRagMs: Math.max(0, toNumber(raw.rag_loop_cooldown_rag_ms, 600000)),
            cooldownAiMs: Math.max(0, toNumber(raw.rag_loop_cooldown_ai_ms, 900000)),
            halfOpenProbeCount: Math.max(1, toNumber(raw.rag_loop_half_open_probe_count, 2)),
            globalBypassMultiOpenEnabled: toBool(raw.rag_loop_global_bypass_multi_open_enabled, true),
            globalBypassMs: Math.max(0, toNumber(raw.rag_loop_global_bypass_ms, 600000))
        };
    }

    getCooldownMs(scope, config) {
        if (scope === 'tmdb_enrichment') {
            return config.cooldownTmdbMs;
        }
        if (scope === 'rag_pass2') {
            return config.cooldownRagMs;
        }
        return config.cooldownAiMs;
    }

    isTimeoutError(error) {
        const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
        const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
        return (
            code === 'ETIMEDOUT' ||
            code === 'ECONNABORTED' ||
            message.includes('timeout') ||
            message.includes('timed out')
        );
    }

    trimWindow(scopeState, config, now) {
        const oldestAllowed = now - config.windowMs;
        scopeState.events = scopeState.events.filter(event => event.timestamp >= oldestAllowed);
    }

    transition(scope, scopeState, nextState, reason, config, now) {
        if (scopeState.state === nextState) {
            return;
        }

        const change = {
            from: scopeState.state,
            to: nextState,
            reason,
            timestamp: now
        };

        scopeState.state = nextState;
        scopeState.lastReason = reason;
        scopeState.lastTransitionAt = now;
        scopeState.history.push(change);
        if (scopeState.history.length > 100) {
            scopeState.history = scopeState.history.slice(scopeState.history.length - 100);
        }

        if (nextState === STATES.OPEN) {
            scopeState.openedAt = now;
            scopeState.openUntil = now + this.getCooldownMs(scope, config);
            scopeState.halfOpenRemaining = config.halfOpenProbeCount;
            scopeState.halfOpenSuccesses = 0;
            this.maybeEnableGlobalBypass(config, now);
        } else if (nextState === STATES.HALF_OPEN) {
            scopeState.halfOpenRemaining = config.halfOpenProbeCount;
            scopeState.halfOpenSuccesses = 0;
        } else if (nextState === STATES.CLOSED) {
            scopeState.openedAt = null;
            scopeState.openUntil = null;
            scopeState.halfOpenRemaining = 0;
            scopeState.halfOpenSuccesses = 0;
            scopeState.events = [];
        }

        logger.info('RAG loop resilience transition', {
            scope,
            from: change.from,
            to: change.to,
            reason
        });
    }

    countOpenScopes() {
        return SCOPES.filter(scope => this.scopes[scope].state === STATES.OPEN).length;
    }

    maybeEnableGlobalBypass(config, now) {
        if (!config.globalBypassMultiOpenEnabled || config.globalBypassMs <= 0) {
            return;
        }

        if (this.countOpenScopes() >= 2) {
            this.globalBypassUntil = now + config.globalBypassMs;
            this.globalBypassReason = 'multi_breaker_open';
        }
    }

    refreshState(scope, config, now) {
        const scopeState = this.scopes[scope];
        if (!scopeState) {
            return null;
        }

        this.trimWindow(scopeState, config, now);

        if (scopeState.state === STATES.OPEN && scopeState.openUntil !== null && now >= scopeState.openUntil) {
            this.transition(scope, scopeState, STATES.HALF_OPEN, 'cooldown_elapsed', config, now);
        }

        if (this.globalBypassUntil !== null && now >= this.globalBypassUntil) {
            this.globalBypassUntil = null;
            this.globalBypassReason = null;
        }

        return scopeState;
    }

    evaluateOpenThreshold(scope, scopeState, config, now) {
        const sampleCount = scopeState.events.length;
        const errorCount = scopeState.events.filter(event => event.success === false).length;
        const timeoutCount = scopeState.events.filter(event => event.timeout === true).length;

        let timeoutStreak = 0;
        for (let i = scopeState.events.length - 1; i >= 0; i -= 1) {
            const current = scopeState.events[i];
            if (current.success === false && current.timeout === true) {
                timeoutStreak += 1;
                continue;
            }
            break;
        }

        const timeoutRate = sampleCount > 0 ? timeoutCount / sampleCount : 0;
        const errorRate = sampleCount > 0 ? errorCount / sampleCount : 0;
        const enoughSamples = sampleCount >= config.minSamples;

        if (enoughSamples && timeoutStreak >= config.timeoutStreakThreshold) {
            this.transition(scope, scopeState, STATES.OPEN, 'timeout_streak_threshold', config, now);
            return;
        }
        if (enoughSamples && timeoutRate >= config.timeoutRateThreshold) {
            this.transition(scope, scopeState, STATES.OPEN, 'timeout_rate_threshold', config, now);
            return;
        }
        if (enoughSamples && errorRate >= config.errorRateThreshold) {
            this.transition(scope, scopeState, STATES.OPEN, 'error_rate_threshold', config, now);
        }
    }

    canRun(scope, rawConfig = {}) {
        if (!SCOPES.includes(scope)) {
            return {
                allowed: true,
                reasonCode: 'unknown_scope',
                state: null,
                fallbackAction: null
            };
        }

        const config = this.resolveConfig(rawConfig);
        if (!config.enabled) {
            return {
                allowed: true,
                reasonCode: 'resilience_disabled',
                state: null,
                fallbackAction: null
            };
        }

        const now = this.nowFn();
        const scopeState = this.refreshState(scope, config, now);
        const fallbackAction = STAGE_FALLBACKS[scope] || 'baseline_preserved';

        if (this.globalBypassUntil !== null && now < this.globalBypassUntil) {
            return {
                allowed: false,
                reasonCode: 'global_bypass_active',
                state: scopeState.state,
                fallbackAction,
                globalBypass: true
            };
        }

        if (scopeState.state === STATES.OPEN) {
            return {
                allowed: false,
                reasonCode: `${scope}_cooldown`,
                state: scopeState.state,
                fallbackAction
            };
        }

        if (scopeState.state === STATES.HALF_OPEN) {
            if (scopeState.halfOpenRemaining <= 0) {
                return {
                    allowed: false,
                    reasonCode: `${scope}_half_open_throttled`,
                    state: scopeState.state,
                    fallbackAction
                };
            }
            scopeState.halfOpenRemaining -= 1;
            return {
                allowed: true,
                reasonCode: `${scope}_half_open_probe`,
                state: scopeState.state,
                fallbackAction
            };
        }

        return {
            allowed: true,
            reasonCode: 'resilience_closed',
            state: scopeState.state,
            fallbackAction: null
        };
    }

    recordSuccess(scope, rawConfig = {}) {
        if (!SCOPES.includes(scope)) {
            return;
        }

        const config = this.resolveConfig(rawConfig);
        if (!config.enabled) {
            return;
        }

        const now = this.nowFn();
        const scopeState = this.refreshState(scope, config, now);
        scopeState.events.push({
            timestamp: now,
            success: true,
            timeout: false
        });
        this.trimWindow(scopeState, config, now);

        if (scopeState.state === STATES.HALF_OPEN) {
            scopeState.halfOpenSuccesses += 1;
            if (scopeState.halfOpenSuccesses >= config.halfOpenProbeCount) {
                this.transition(scope, scopeState, STATES.CLOSED, 'half_open_probe_recovered', config, now);
            }
        }
    }

    recordFailure(scope, error, rawConfig = {}) {
        if (!SCOPES.includes(scope)) {
            return;
        }

        const config = this.resolveConfig(rawConfig);
        if (!config.enabled) {
            return;
        }

        const now = this.nowFn();
        const scopeState = this.refreshState(scope, config, now);
        scopeState.events.push({
            timestamp: now,
            success: false,
            timeout: this.isTimeoutError(error)
        });
        this.trimWindow(scopeState, config, now);

        if (scopeState.state === STATES.HALF_OPEN) {
            this.transition(scope, scopeState, STATES.OPEN, 'half_open_probe_failed', config, now);
            return;
        }

        if (scopeState.state === STATES.CLOSED) {
            this.evaluateOpenThreshold(scope, scopeState, config, now);
        }
    }

    getDiagnostics(limit = 20) {
        const byScope = {};
        for (const scope of SCOPES) {
            const scopeState = this.scopes[scope];
            byScope[scope] = {
                state: scopeState.state,
                opened_at: scopeState.openedAt,
                open_until: scopeState.openUntil,
                half_open_remaining: scopeState.halfOpenRemaining,
                half_open_successes: scopeState.halfOpenSuccesses,
                last_reason: scopeState.lastReason,
                last_transition_at: scopeState.lastTransitionAt,
                history: scopeState.history.slice(-Math.max(1, limit))
            };
        }

        return {
            global_bypass_until: this.globalBypassUntil,
            global_bypass_reason: this.globalBypassReason,
            scopes: byScope
        };
    }
}

module.exports = new RagLoopResilienceManager();
module.exports.RagLoopResilienceManager = RagLoopResilienceManager;
module.exports.STATES = STATES;
