/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ConflictError, ValidationError } from '../utils/appError.mjs';

export const COHORT_VERSION = 'feedback_suggestions.v1';
export const MAX_COHORT_ROWS = 5000;
export const MAX_COHORT_BYTES = 2 * 1024 * 1024;
const metadataKeys = ['genres', 'production_companies', 'keywords', 'belongs_to_collection'];
const scoreKeys = ['preset', 'pattern', 'rag', 'history'];
const cosmeticPolicyKeys = new Set(['created_at', 'updated_at', 'created_by', 'name', 'description', 'notify_channels', 'native_intent_active']);

// Define own properties safely, including metadata keys such as __proto__.
function canonicalValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]));
    }
    return value;
}
export const canonicalCohortJson = value => JSON.stringify(canonicalValue(value));
export const cohortDigest = value => createHash('sha256').update(canonicalCohortJson(value)).digest('hex');
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value || {}, key)).map(key => [key, value[key]]));

export function projectPolicy(policy) {
    return Object.fromEntries(Object.entries(policy).filter(([key]) => !cosmeticPolicyKeys.has(key)));
}
export function projectDestination(library) {
    return pick(library, ['id', 'media_server_id', 'external_id', 'media_type', 'is_active']);
}
export function projectFeedback(row) {
    return {
        ...pick(row, ['id', 'selected_policy_id', 'selected_library_id', 'was_correction',
            'top_suggestion_library_id', 'top_suggestion_score', 'prompt_type']),
        prompted_at: new Date(row.prompted_at).toISOString(),
        item_metadata: pick(row.item_metadata, metadataKeys),
        original_scores: pick(row.original_scores, scoreKeys),
    };
}
export function evidenceConflict(code = 'SUGGESTION_EVIDENCE_STALE') {
    return new ConflictError('Suggestion evidence is no longer current. Run analysis to refresh suggestions.', { code });
}
export function assertCohortShape(manifest) {
    const rows = manifest?.feedback;
    if (manifest?.version !== COHORT_VERSION || !manifest.policy || !manifest.destination
        || !Number.isInteger(manifest.days) || manifest.days < 1 || manifest.days > 365
        || !Number.isFinite(Date.parse(manifest.captured_at))
        || !Array.isArray(rows) || rows.length === 0 || rows.length > MAX_COHORT_ROWS
        || rows.some(row => !row || !Number.isInteger(row.id) || row.id < 1 || row.id > 2147483647
            || !Number.isFinite(Date.parse(row.prompted_at)))
        || new Set(rows.map(row => row.id)).size !== rows.length) {
        throw evidenceConflict();
    }
    if (Buffer.byteLength(canonicalCohortJson(manifest)) > MAX_COHORT_BYTES) {
        throw new ValidationError('Feedback cohort exceeds the 2 MiB limit. Use a shorter analysis period.', { code: 'SUGGESTION_COHORT_TOO_LARGE' });
    }
}
export function suggestionEvidenceDigest(fingerprint, type, config, supportingIds) {
    return cohortDigest({ fingerprint, type, config, supportingIds });
}
