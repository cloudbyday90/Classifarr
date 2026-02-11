/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const IDENTIFIER_CAP_KEYS = ['keywords', 'genres', 'studios', 'cast'];

const DEFAULT_IDENTIFIER_CAPS = Object.freeze({
    keywords: 8,
    genres: 5,
    studios: 3,
    cast: 3
});

const ISSUE_275_V1_PREFIXES = Object.freeze([
    'rag_retrieval_loop_',
    'rag_loop_',
    'rag_conflict_',
    'rag_retry_',
    'policy_recheck_',
    'policy_learning_',
    'rag_alias_',
    'rag_title_'
]);

const ISSUE_275_V11_DISALLOWED_KEYS = Object.freeze([
    'rag_loop_override',
    'policy_rag_loop_override',
    'library_policy_rag_loop_override',
    'library_policies.rag_loop_override'
]);

const RAG_LOOP_CONFIG_MANIFEST = Object.freeze({
    rag_retrieval_loop_enabled: { type: 'boolean', default: true },
    rag_loop_rollout_mode: { type: 'enum', default: 'apply', values: ['shadow', 'apply'] },
    rag_loop_low_confidence_threshold: { type: 'integer', default: 70, min: 0, max: 100 },
    rag_loop_max_passes: { type: 'integer', default: 2, min: 1, max: 2 },
    rag_loop_use_hybrid_on_retry: { type: 'boolean', default: true },
    rag_loop_conflict_detection_enabled: { type: 'boolean', default: false },
    rag_retry_strategy: { type: 'enum', default: 'auto', values: ['auto', 'hybrid', 'semantic'] },
    rag_retry_low_signal_similarity_floor: { type: 'number', default: 0.55, min: 0, max: 1 },
    rag_retry_conflict_semantic_preferred: { type: 'boolean', default: true },
    rag_retry_sparse_metadata_prefers_hybrid: { type: 'boolean', default: true },
    rag_loop_candidate_limit: { type: 'integer', default: 25, min: 1, max: 100 },
    rag_conflict_top_n: { type: 'integer', default: 5, min: 1, max: 50 },
    rag_conflict_min_matches: { type: 'integer', default: 3, min: 1, max: 50 },
    rag_conflict_min_votes_per_library: { type: 'integer', default: 2, min: 1, max: 10 },
    rag_conflict_max_vote_gap: { type: 'integer', default: 1, min: 0, max: 10 },
    rag_conflict_max_similarity_margin_ratio: { type: 'number', default: 0.1, min: 0, max: 1 },
    rag_conflict_min_avg_similarity: { type: 'number', default: 0.55, min: 0, max: 1 },
    policy_recheck_below_prompt_threshold_enabled: { type: 'boolean', default: true },
    policy_recheck_max_attempts: { type: 'integer', default: 1, min: 0, max: 5 },
    policy_recheck_identifier_caps: { type: 'identifier_caps', default: DEFAULT_IDENTIFIER_CAPS },
    policy_recheck_min_similarity_delta: { type: 'number', default: 0.08, min: 0, max: 1 },
    policy_recheck_min_margin_delta: { type: 'number', default: 10, min: 0, max: 100 },
    policy_recheck_min_confidence_gain: { type: 'number', default: 5, min: 0, max: 100 },
    policy_recheck_max_ai_calls_per_item: { type: 'integer', default: 2, min: 1, max: 5 },
    policy_recheck_metadata_enrichment_enabled: { type: 'boolean', default: true },
    policy_recheck_metadata_missing_fields_min: { type: 'integer', default: 2, min: 0, max: 10 },
    policy_recheck_metadata_timeout_ms: { type: 'integer', default: 2000, min: 100, max: 30000 },
    policy_recheck_metadata_max_attempts: { type: 'integer', default: 1, min: 0, max: 5 },
    policy_recheck_metadata_source: { type: 'enum', default: 'authoritative_only', values: ['authoritative_only'] },

    rag_loop_shadow_min_samples: { type: 'integer', default: 200, min: 1, max: 1000000 },
    rag_loop_shadow_max_error_rate_delta: { type: 'number', default: 0.01, min: 0, max: 1 },
    rag_loop_shadow_max_p95_latency_delta_ms: { type: 'integer', default: 250, min: 0, max: 600000 },
    rag_loop_auto_fallback_enabled: { type: 'boolean', default: true },
    rag_loop_auto_fallback_min_apply_samples: { type: 'integer', default: 25, min: 1, max: 1000000 },
    rag_loop_auto_fallback_consecutive_breaches: { type: 'integer', default: 3, min: 1, max: 100 },
    rag_loop_auto_fallback_cooldown_ms: { type: 'integer', default: 900000, min: 0, max: 86400000 },
    rag_loop_auto_recover_enabled: { type: 'boolean', default: false },
    rag_loop_trace_enabled: { type: 'boolean', default: true },
    rag_loop_trace_max_events: { type: 'integer', default: 20, min: 1, max: 200 },
    rag_loop_trace_max_bytes: { type: 'integer', default: 16384, min: 256, max: 131072 },
    rag_loop_trace_include_stage_metrics: { type: 'boolean', default: true },
    policy_learning_second_pass_requires_manual_confirmation: { type: 'boolean', default: true },
    policy_learning_include_shadow_feedback: { type: 'boolean', default: false },
    policy_learning_allow_machine_only_second_pass_feedback: { type: 'boolean', default: false },
    rag_alias_expansion_enabled: { type: 'boolean', default: true },
    rag_alias_max_terms: { type: 'integer', default: 5, min: 1, max: 20 },
    rag_alias_min_token_length: { type: 'integer', default: 3, min: 1, max: 10 },
    rag_alias_source_policy: { type: 'enum', default: 'authoritative_only', values: ['authoritative_only'] },
    rag_title_precedence_mode: { type: 'enum', default: 'canonical_first', values: ['canonical_first'] },
    rag_alias_weight: { type: 'number', default: 0.6, min: 0, max: 1 },
    rag_loop_resilience_enabled: { type: 'boolean', default: true },
    rag_loop_resilience_window_ms: { type: 'integer', default: 300000, min: 1000, max: 3600000 },
    rag_loop_resilience_min_samples: { type: 'integer', default: 20, min: 1, max: 10000 },
    rag_loop_resilience_timeout_streak_threshold: { type: 'integer', default: 3, min: 1, max: 20 },
    rag_loop_resilience_timeout_rate_threshold: { type: 'number', default: 0.35, min: 0, max: 1 },
    rag_loop_resilience_error_rate_threshold: { type: 'number', default: 0.5, min: 0, max: 1 },
    rag_loop_cooldown_tmdb_ms: { type: 'integer', default: 900000, min: 0, max: 86400000 },
    rag_loop_cooldown_rag_ms: { type: 'integer', default: 600000, min: 0, max: 86400000 },
    rag_loop_cooldown_ai_ms: { type: 'integer', default: 900000, min: 0, max: 86400000 },
    rag_loop_half_open_probe_count: { type: 'integer', default: 2, min: 1, max: 20 },
    rag_loop_global_bypass_multi_open_enabled: { type: 'boolean', default: true },
    rag_loop_global_bypass_ms: { type: 'integer', default: 600000, min: 0, max: 86400000 }
});

const RAG_LOOP_V1_KEYS = Object.freeze(Object.keys(RAG_LOOP_CONFIG_MANIFEST));

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function parseBoolean(value, fallback) {
    if (typeof value === 'boolean') {
        return { value, changed: false };
    }
    if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        if (lower === 'true' || lower === '1') {
            return { value: true, changed: true };
        }
        if (lower === 'false' || lower === '0') {
            return { value: false, changed: true };
        }
    }
    if (typeof value === 'number') {
        if (value === 1) {
            return { value: true, changed: true };
        }
        if (value === 0) {
            return { value: false, changed: true };
        }
    }
    return { value: fallback, changed: true };
}

function parseInteger(value, fallback, min, max) {
    let numeric;
    if (typeof value === 'number' && Number.isFinite(value)) {
        numeric = value;
    } else if (typeof value === 'string' && value.trim() !== '') {
        numeric = Number(value);
    } else {
        return { value: fallback, changed: true };
    }

    if (!Number.isFinite(numeric)) {
        return { value: fallback, changed: true };
    }

    const rounded = Math.trunc(numeric);
    const clamped = Math.max(min, Math.min(max, rounded));
    return { value: clamped, changed: clamped !== value };
}

function parseNumber(value, fallback, min, max) {
    let numeric;
    if (typeof value === 'number' && Number.isFinite(value)) {
        numeric = value;
    } else if (typeof value === 'string' && value.trim() !== '') {
        numeric = Number(value);
    } else {
        return { value: fallback, changed: true };
    }

    if (!Number.isFinite(numeric)) {
        return { value: fallback, changed: true };
    }

    const clamped = Math.max(min, Math.min(max, numeric));
    return { value: clamped, changed: clamped !== value };
}

function normalizeIdentifierCaps(value, fallback) {
    let raw = value;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            raw = null;
        }
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        raw = fallback;
    }

    const normalized = {};
    for (const key of IDENTIFIER_CAP_KEYS) {
        const current = hasOwn(raw, key) ? raw[key] : fallback[key];
        normalized[key] = parseInteger(current, fallback[key], 0, 25).value;
    }

    return normalized;
}

function normalizeConfigValue(value, spec) {
    if (value === undefined || value === null) {
        return { value: spec.default, changed: true };
    }

    switch (spec.type) {
    case 'boolean':
        return parseBoolean(value, spec.default);
    case 'integer':
        return parseInteger(value, spec.default, spec.min, spec.max);
    case 'number':
        return parseNumber(value, spec.default, spec.min, spec.max);
    case 'enum':
        if (spec.values.includes(value)) {
            return { value, changed: false };
        }
        return { value: spec.default, changed: true };
    case 'identifier_caps': {
        const normalized = normalizeIdentifierCaps(value, spec.default);
        const changed = JSON.stringify(normalized) !== JSON.stringify(value);
        return { value: normalized, changed };
    }
    default:
        return { value: spec.default, changed: true };
    }
}

function getRagLoopDefaultConfig() {
    const defaults = {};
    for (const [key, spec] of Object.entries(RAG_LOOP_CONFIG_MANIFEST)) {
        if (spec.type === 'identifier_caps') {
            defaults[key] = { ...spec.default };
            continue;
        }
        defaults[key] = spec.default;
    }
    return defaults;
}

function validateAndNormalizeRagLoopConfig(rawConfig = {}, existingConfig = {}) {
    const normalizedConfig = {};
    const warnings = [];

    for (const [key, spec] of Object.entries(RAG_LOOP_CONFIG_MANIFEST)) {
        const hasRaw = hasOwn(rawConfig, key);
        const sourceValue = hasRaw ? rawConfig[key] : existingConfig[key];
        const normalized = normalizeConfigValue(sourceValue, spec);
        normalizedConfig[key] = normalized.value;

        if (hasRaw && normalized.changed) {
            warnings.push({
                key,
                provided: rawConfig[key],
                normalized: normalized.value
            });
        }
    }

    return { normalizedConfig, warnings };
}

function isIssue275KeyPrefix(key) {
    return ISSUE_275_V1_PREFIXES.some(prefix => key.startsWith(prefix));
}

function validateIssue275PayloadKeys(rawConfig = {}) {
    const keys = Object.keys(rawConfig || {});
    const unknownKeys = keys.filter(key => isIssue275KeyPrefix(key) && !RAG_LOOP_V1_KEYS.includes(key));
    const disallowedKeys = keys.filter(key => ISSUE_275_V11_DISALLOWED_KEYS.includes(key));

    return {
        unknownKeys,
        disallowedKeys,
        valid: unknownKeys.length === 0 && disallowedKeys.length === 0
    };
}

function resolveRagLoopEffectiveConfig({
    globalConfig = {},
    policyOverride = null,
    enablePolicyOverrides = false
} = {}) {
    const normalizedGlobal = validateAndNormalizeRagLoopConfig(globalConfig).normalizedConfig;
    const effectiveConfig = { ...normalizedGlobal };
    const sourceMap = {};

    for (const key of RAG_LOOP_V1_KEYS) {
        sourceMap[key] = 'global';
    }

    if (!enablePolicyOverrides || !policyOverride || policyOverride.enabled !== true) {
        return { effectiveConfig, sourceMap };
    }

    // V1.1-only behavior is intentionally disabled by default in V1.
    return { effectiveConfig, sourceMap };
}

module.exports = {
    DEFAULT_IDENTIFIER_CAPS,
    ISSUE_275_V11_DISALLOWED_KEYS,
    RAG_LOOP_CONFIG_MANIFEST,
    RAG_LOOP_V1_KEYS,
    getRagLoopDefaultConfig,
    resolveRagLoopEffectiveConfig,
    validateAndNormalizeRagLoopConfig,
    validateIssue275PayloadKeys
};
