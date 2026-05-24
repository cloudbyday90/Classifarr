/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';
import {
    STATES,
    SCOPES,
    STAGE_FALLBACKS,
    resolveConfig as _resolveConfig,
    getCooldownMs as _getCooldownMs,
    isTimeoutError as _isTimeoutError,
    trimWindow as _trimWindow,
    evaluateOpenThreshold as _evaluateOpenThreshold
} from './ragLoopResilienceConfig.mjs';

export { STATES } from './ragLoopResilienceConfig.mjs';

const logger = createLogger('RagLoopResilience');

export class RagLoopResilienceManager {
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
        return _resolveConfig(raw);
    }

    getCooldownMs(scope, config) {
        return _getCooldownMs(scope, config);
    }

    isTimeoutError(error) {
        return _isTimeoutError(error);
    }

    trimWindow(scopeState, config, now) {
        _trimWindow(scopeState, config, now);
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
        _evaluateOpenThreshold(scope, scopeState, config, now,
            (s, ss, ns, r, c, n) => this.transition(s, ss, ns, r, c, n)
        );
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

export const ragLoopResilienceManager = new RagLoopResilienceManager();
