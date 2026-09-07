/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
import { OBSERVATION_TYPES } from './originalObservationTypeCounts.mjs';

// Only validated original methods, never mutable current methods, establish origin.
// SQL structure and method literals come exclusively from internal allowlists.
export const ORIGINAL_OBSERVATION_TYPE_SQL = `CASE
    WHEN history.provenance_status <> 'captured' THEN 'unknown_origin'
    WHEN history.original_method IN ('source_library', 'authoritative_source_library', 'existing_media') THEN 'imported_membership'
    WHEN history.original_method IN ('manual_classification', 'manual_correction') THEN 'manual_action'
    WHEN history.original_method IN (${CLASSIFIER_CAPTURE_METHODS.map(method => `'${method}'`).join(', ')}) THEN 'classifier_workflow'
    ELSE 'unknown_origin' END`;

export const ORIGINAL_OBSERVATION_COUNTS_SQL = OBSERVATION_TYPES.map(type =>
    `count(*) FILTER (WHERE time_scope = 'window' AND observation_type = '${type}') AS ${type}_events`).join(',\n        ');
