/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { NotFoundError } from '../utils/appError.mjs';

const MAX_CONFIG_BYTES = 4 * 1024;
const MAX_PROPOSAL_BYTES = 8 * 1024;
const THRESHOLDS = new Set(['auto_classify', 'prompt']);
const SIGNALS = new Set(['preset', 'pattern', 'rag', 'history']);
const PATTERNS = new Set(['genre', 'studio', 'keyword', 'collection']);

function numberInRange(value, max) {
    return Number.isFinite(value) && value >= 0 && value <= max;
}

function projectConfiguration(type, config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
    const { current, recommended, threshold_type, signal, pattern_type, pattern_value, confidence } = config;
    switch (type) {
        case 'adjust_threshold':
            if (!THRESHOLDS.has(threshold_type) || !numberInRange(recommended, 100) ||
                (current != null && !numberInRange(current, 100))) return null;
            return { threshold_type, current: current ?? null, recommended };
        case 'adjust_weight':
            if (!SIGNALS.has(signal) || !numberInRange(recommended, 1) ||
                (current != null && !numberInRange(current, 1))) return null;
            return { signal, current: current ?? null, recommended };
        case 'create_pattern':
            if (!PATTERNS.has(pattern_type) || typeof pattern_value !== 'string' || pattern_value.length > 240 ||
                !pattern_value.trim() || (confidence != null && !numberInRange(confidence, 100))) return null;
            return { pattern_type, pattern_value, confidence: confidence ?? null };
        default:
            return null;
    }
}

export async function readSavedSuggestionProposal(db, id) {
    const { rows: [row] } = await db.query(`
        SELECT s.id, s.policy_id, left(p.name, 160) AS policy_name, left(l.name, 160) AS library_name,
            left(s.suggestion_type, 30) AS suggestion_type, left(s.status, 20) AS status, s.confidence,
            left(s.impact_estimate, 100) AS impact_estimate, s.created_at,
            COALESCE(cardinality(s.supporting_feedback_ids), 0) AS reference_count,
            CASE WHEN octet_length(s.suggestion_config::text) <= $2 THEN s.suggestion_config END AS configuration
        FROM policy_tuning_suggestions s
        JOIN library_policies p ON p.id = s.policy_id
        JOIN libraries l ON l.id = p.library_id
        WHERE s.id = $1
    `, [id, MAX_CONFIG_BYTES]);
    if (!row) throw new NotFoundError('Suggestion not found');

    const { configuration, ...fields } = row;
    const suggestionConfig = projectConfiguration(fields.suggestion_type, configuration);
    const body = JSON.stringify({
        ...fields,
        created_at: fields.created_at instanceof Date ? fields.created_at.toJSON() : null,
        proposal_status: suggestionConfig ? 'available' : 'unavailable',
        suggestion_config: suggestionConfig,
    });
    if (Buffer.byteLength(body) > MAX_PROPOSAL_BYTES) throw new Error('Suggestion proposal exceeded its response limit');
    return body;
}
