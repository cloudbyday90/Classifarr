/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';

export const NON_CLASSIFIER_CAPTURE_METHODS = Object.freeze(['source_library', 'authoritative_source_library', 'existing_media',
    'manual_classification', 'manual_correction']);
export const CLASSIFIER_CAPTURE_METHODS = Object.freeze(['exact_match', 'learned_pattern', 'policy_auto', 'policy_prompt', 'policy_recheck',
    'ai_verified', 'ai_analysis', 'ai_rerun', 'signal_calculation', 'fallback', 'queued_for_retry', 'custom_rule',
    'rule_match', 'ai_fallback', 'holiday_detection', 'library_rule', 'rag_improved', 'policy_engine',
    'policy_candidate_adjudication']);
const nonClassifierMethods = new Set(NON_CLASSIFIER_CAPTURE_METHODS);
const classifierMethods = new Set(CLASSIFIER_CAPTURE_METHODS);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function snapshot(status, source = null, libraryId = null) {
    return { version: 'classification.candidate_capture.v1', stage: 'pre_routing', status, source, library_id: libraryId };
}

function candidate(value, source, ranked = false) {
    if (!object(value)) return snapshot('invalid_candidate', source);
    const libraryId = positiveDatabaseInteger(ranked ? value.library_id : value.id ?? value.library_id);
    // Conflicting aliases must not select whichever identifier happens to come first.
    const conflict = !ranked && value.id != null && value.library_id != null &&
        positiveDatabaseInteger(value.id) !== positiveDatabaseInteger(value.library_id);
    return libraryId === null || conflict ? snapshot('invalid_candidate', source) : snapshot('recorded', source, libraryId);
}

function captureResult(result) {
    if (nonClassifierMethods.has(result.method)) return snapshot('not_applicable');
    if (!classifierMethods.has(result.method)) return snapshot('unsupported_method');
    for (const [ranked, source] of [[result.policyResult?.ranked, 'policy_ranked'], [result.signalContext?.ranked, 'signal_ranked']]) {
        if (ranked == null) continue;
        if (!Array.isArray(ranked)) return snapshot('invalid_candidate', source);
        if (ranked.length > 0) return candidate(ranked[0], source, true);
    }
    // A default fallback destination and a retry envelope are not classifier proposals.
    if (!['fallback', 'queued_for_retry'].includes(result.method) && result.library != null) {
        return candidate(result.library, 'decision_proposal');
    }
    if (result.signalContext?.suggestedLibrary != null) {
        return candidate(result.signalContext.suggestedLibrary, 'signal_proposal');
    }
    return snapshot('no_candidate');
}

/** Capture only the current classifier result, never caller metadata or a later selected destination. */
export function buildClassificationCandidateCapture(result = {}) {
    return { ...captureResult(result), method: classifierMethods.has(result.method) || nonClassifierMethods.has(result.method)
        ? result.method : null };
}
