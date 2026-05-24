export const STATES = Object.freeze({
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
});

export const SCOPES = Object.freeze(['tmdb_enrichment', 'rag_pass2', 'ai_rerun']);

export const STAGE_FALLBACKS = Object.freeze({
    tmdb_enrichment: 'enrichment_skipped',
    rag_pass2: 'pass2_skipped',
    ai_rerun: 'ai_rerun_skipped'
});

export function resolveConfig(raw = {}) {
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

export function getCooldownMs(scope, config) {
    if (scope === 'tmdb_enrichment') return config.cooldownTmdbMs;
    if (scope === 'rag_pass2') return config.cooldownRagMs;
    return config.cooldownAiMs;
}

export function isTimeoutError(error) {
    const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
    const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
    return (
        code === 'ETIMEDOUT' ||
        code === 'ECONNABORTED' ||
        message.includes('timeout') ||
        message.includes('timed out')
    );
}

export function trimWindow(scopeState, config, now) {
    const oldestAllowed = now - config.windowMs;
    scopeState.events = scopeState.events.filter(event => event.timestamp >= oldestAllowed);
}

export function evaluateOpenThreshold(scope, scopeState, config, now, transitionFn) {
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
        transitionFn(scope, scopeState, STATES.OPEN, 'timeout_streak_threshold', config, now);
        return;
    }
    if (enoughSamples && timeoutRate >= config.timeoutRateThreshold) {
        transitionFn(scope, scopeState, STATES.OPEN, 'timeout_rate_threshold', config, now);
        return;
    }
    if (enoughSamples && errorRate >= config.errorRateThreshold) {
        transitionFn(scope, scopeState, STATES.OPEN, 'error_rate_threshold', config, now);
    }
}
