/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function loadRagLoopConfig({ db, getRagLoopDefaultConfig, validateAndNormalizeRagLoopConfig }, selectSql) {
    const defaults = getRagLoopDefaultConfig();
    let configRow = {};

    try {
        const result = await db.query(selectSql);
        configRow = result.rows[0] || {};
    } catch (configError) {
        if (!['42P01', '42703'].includes(configError.code)) {
            throw configError;
        }
        configRow = {};
    }

    const mergedConfig = { ...defaults, ...configRow };
    const { normalizedConfig } = validateAndNormalizeRagLoopConfig(mergedConfig, mergedConfig);

    return { configRow, normalizedConfig };
}

export async function getLatestFallbackIncidentPayload(deps) {
    const { configRow, normalizedConfig } = await loadRagLoopConfig(deps, `
        SELECT
            rag_loop_rollout_mode,
            rag_loop_auto_fallback_enabled,
            rag_loop_auto_fallback_min_apply_samples,
            rag_loop_auto_fallback_consecutive_breaches,
            rag_loop_auto_fallback_cooldown_ms,
            rag_loop_auto_recover_enabled,
            rag_loop_auto_fallback_breach_count,
            rag_loop_auto_fallback_last_breach_at,
            rag_loop_auto_fallback_last_triggered_at,
            rag_loop_auto_fallback_cooldown_until,
            rag_loop_auto_fallback_last_incident_id,
            rag_loop_auto_fallback_last_incident_payload,
            rag_loop_auto_fallback_last_version,
            rag_loop_auto_recover_last_attempt_version,
            rag_loop_auto_recover_last_attempt_at
        FROM ai_provider_config
        WHERE id = 1
    `);

    let incident = null;
    if (
        configRow.rag_loop_auto_fallback_last_incident_payload &&
        typeof configRow.rag_loop_auto_fallback_last_incident_payload === 'object' &&
        !Array.isArray(configRow.rag_loop_auto_fallback_last_incident_payload)
    ) {
        incident = {
            ...configRow.rag_loop_auto_fallback_last_incident_payload
        };
    }

    if (incident) {
        if (!incident.incident_id && configRow.rag_loop_auto_fallback_last_incident_id) {
            incident.incident_id = configRow.rag_loop_auto_fallback_last_incident_id;
        }
        if (!incident.triggered_at && configRow.rag_loop_auto_fallback_last_triggered_at) {
            incident.triggered_at = configRow.rag_loop_auto_fallback_last_triggered_at;
        }
    }

    return {
        incident,
        rollout_mode: normalizedConfig.rag_loop_rollout_mode,
        fallback_state: {
            auto_fallback_enabled: normalizedConfig.rag_loop_auto_fallback_enabled,
            auto_recover_enabled: normalizedConfig.rag_loop_auto_recover_enabled,
            breach_count: Math.max(0, Number(configRow.rag_loop_auto_fallback_breach_count || 0)),
            cooldown_until: configRow.rag_loop_auto_fallback_cooldown_until || null,
            last_triggered_at: configRow.rag_loop_auto_fallback_last_triggered_at || null,
            last_fallback_version: configRow.rag_loop_auto_fallback_last_version || null,
            last_recover_attempt_version: configRow.rag_loop_auto_recover_last_attempt_version || null,
            last_recover_attempt_at: configRow.rag_loop_auto_recover_last_attempt_at || null
        },
        checked_at: new Date().toISOString()
    };
}

export async function getPromotionReadinessPayload(deps) {
    const { normalizedConfig } = await loadRagLoopConfig(deps, `
        SELECT
            rag_loop_shadow_min_samples,
            rag_loop_shadow_max_error_rate_delta,
            rag_loop_shadow_max_p95_latency_delta_ms
        FROM ai_provider_config
        WHERE id = 1
    `);

    const readiness = deps.ragLoopMetricsCollector.canPromote(normalizedConfig);

    return {
        ready: readiness.ready,
        metrics: readiness.metrics,
        gates: {
            min_samples: normalizedConfig.rag_loop_shadow_min_samples,
            max_error_rate_delta: normalizedConfig.rag_loop_shadow_max_error_rate_delta,
            max_p95_latency_delta_ms: normalizedConfig.rag_loop_shadow_max_p95_latency_delta_ms
        },
        checked_at: new Date().toISOString()
    };
}
