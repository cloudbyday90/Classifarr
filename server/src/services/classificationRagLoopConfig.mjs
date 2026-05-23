import * as db from '../config/database.mjs';
import { validateAndNormalizeRagLoopConfig } from '../utils/ragLoopConfig.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('classificationRagLoop');

export async function getRagLoopConfig() {
    try {
        const result = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');
        const row = result.rows[0] || {};
        const normalized = validateAndNormalizeRagLoopConfig(row).normalizedConfig;
        return {
            ...normalized,
            rag_loop_auto_fallback_breach_count: Math.max(0, Number(row.rag_loop_auto_fallback_breach_count || 0)),
            rag_loop_auto_fallback_last_breach_at: row.rag_loop_auto_fallback_last_breach_at || null,
            rag_loop_auto_fallback_last_triggered_at: row.rag_loop_auto_fallback_last_triggered_at || null,
            rag_loop_auto_fallback_cooldown_until: row.rag_loop_auto_fallback_cooldown_until || null,
            rag_loop_auto_fallback_last_incident_id: row.rag_loop_auto_fallback_last_incident_id || null,
            rag_loop_auto_fallback_last_incident_payload: row.rag_loop_auto_fallback_last_incident_payload || null,
            rag_loop_auto_fallback_last_version: row.rag_loop_auto_fallback_last_version || null,
            rag_loop_auto_recover_last_attempt_version: row.rag_loop_auto_recover_last_attempt_version || null,
            rag_loop_auto_recover_last_attempt_at: row.rag_loop_auto_recover_last_attempt_at || null,
        };
    } catch (error) {
        logger.warn('Failed to load rag loop config, using defaults', { error: error.message });
        return {
            ...validateAndNormalizeRagLoopConfig({}).normalizedConfig,
            rag_loop_auto_fallback_breach_count: 0,
            rag_loop_auto_fallback_last_breach_at: null,
            rag_loop_auto_fallback_last_triggered_at: null,
            rag_loop_auto_fallback_cooldown_until: null,
            rag_loop_auto_fallback_last_incident_id: null,
            rag_loop_auto_fallback_last_incident_payload: null,
            rag_loop_auto_fallback_last_version: null,
            rag_loop_auto_recover_last_attempt_version: null,
            rag_loop_auto_recover_last_attempt_at: null,
        };
    }
}
