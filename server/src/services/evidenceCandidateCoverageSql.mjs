/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CLASSIFIER_CAPTURE_METHODS, NON_CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';

// All expressions are fixed application SQL, never request-supplied identifiers.
const details = "classification_history.metadata #> '{classification_details}'";
const capture = `(${details} -> 'candidate_capture')`;
const ranked = `(${details} -> 'ranked_candidates')`;
const sources = "('policy_ranked', 'signal_ranked', 'decision_proposal', 'signal_proposal')";
const classifierMethods = `(${CLASSIFIER_CAPTURE_METHODS.map(method => `'${method}'`).join(', ')})`;
const nonClassifierMethods = `(${NON_CLASSIFIER_CAPTURE_METHODS.map(method => `'${method}'`).join(', ')})`;
const validId = expression => `CASE WHEN (${expression}) ~ '^[1-9][0-9]{0,9}$'
    THEN (${expression})::bigint <= 2147483647 ELSE FALSE END`;

export const EVIDENCE_CANDIDATE_STATUS_SQL = `CASE
    WHEN ${capture} IS NOT NULL THEN CASE
        WHEN jsonb_typeof(${capture}) = 'object'
            AND ${capture} ->> 'version' = 'classification.candidate_capture.v1'
            AND ${capture} ->> 'stage' = 'pre_routing'
        THEN CASE
            WHEN ${capture} ->> 'status' = 'recorded' AND ${capture} ->> 'method' IN ${classifierMethods}
                AND ${capture} ->> 'source' IN ${sources}
                AND (${validId(`${capture} ->> 'library_id'`)}) THEN 'recorded'
            WHEN ${capture} ->> 'status' = 'invalid_candidate' AND ${capture} ->> 'method' IN ${classifierMethods}
                AND ${capture} -> 'library_id' = 'null'::jsonb
                AND (${capture} ->> 'source' IN ${sources} OR ${capture} -> 'source' = 'null'::jsonb) THEN 'invalid_candidate'
            WHEN ${capture} -> 'library_id' = 'null'::jsonb AND ${capture} -> 'source' = 'null'::jsonb THEN CASE
                WHEN ${capture} ->> 'status' = 'no_candidate' AND ${capture} ->> 'method' IN ${classifierMethods} THEN 'no_candidate'
                WHEN ${capture} ->> 'status' = 'not_applicable' AND ${capture} ->> 'method' IN ${nonClassifierMethods} THEN 'not_applicable'
                WHEN ${capture} ->> 'status' = 'unsupported_method' AND ${capture} -> 'method' = 'null'::jsonb THEN 'unrecorded'
                ELSE 'invalid_candidate' END
            ELSE 'invalid_candidate' END
        ELSE 'invalid_candidate' END
    WHEN classification_history.method IN ('source_library', 'authoritative_source_library', 'existing_media') THEN 'not_applicable'
    WHEN jsonb_typeof(${ranked}) = 'array' AND jsonb_typeof(${ranked} -> 0) = 'object'
        AND (${validId(`${ranked} #>> '{0,library_id}'`)}) THEN 'recorded'
    WHEN classification_history.method IN ('manual_classification', 'manual_correction') THEN 'not_applicable'
    WHEN ${ranked} IS NOT NULL AND ${ranked} NOT IN ('null'::jsonb, '[]'::jsonb) THEN 'invalid_candidate'
    ELSE 'unrecorded' END`;
