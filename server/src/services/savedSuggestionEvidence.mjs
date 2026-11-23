/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { NotFoundError } from '../utils/appError.mjs';
import { MAX_COHORT_ROWS } from './feedbackAnalysisCohortContract.mjs';

export const MAX_SUGGESTION_EVIDENCE_REFERENCES = MAX_COHORT_ROWS;
const PAGE_SIZE = 20;
const MAX_PAGE_BYTES = 48 * 1024;

export async function readSavedSuggestionEvidencePage(db, suggestionId, afterPosition) {
    const { rows } = await db.query(`
        WITH suggestion AS (
            SELECT s.policy_id, p.library_id, left(destination.name, 80) AS selected_library,
                s.supporting_feedback_ids AS support,
                CASE
                    WHEN COALESCE(cardinality(s.supporting_feedback_ids), 0) = 0 THEN 0
                    WHEN array_ndims(s.supporting_feedback_ids) = 1
                        AND array_lower(s.supporting_feedback_ids, 1) = 1
                        AND cardinality(s.supporting_feedback_ids) <= $4
                    THEN cardinality(s.supporting_feedback_ids)
                END AS reference_count
            FROM policy_tuning_suggestions s
            JOIN library_policies p ON p.id = s.policy_id
            JOIN libraries destination ON destination.id = p.library_id
            WHERE s.id = $1
        )
        SELECT s.reference_count, $2 + slot.ordinality::integer AS position,
            feedback.id AS feedback_id, feedback.title, feedback.prompted_at, feedback.was_correction,
            left(original.name, 80) AS original_library, s.selected_library
        FROM suggestion s
        LEFT JOIN LATERAL unnest(CASE WHEN s.reference_count > $2
            THEN s.support[($2 + 1):($2 + $3)] END) WITH ORDINALITY AS slot(feedback_id, ordinality) ON TRUE
        LEFT JOIN LATERAL (
            SELECT f.id, left(f.title, 160) AS title, f.prompted_at, f.was_correction, f.top_suggestion_library_id
            FROM policy_feedback_log f
            WHERE f.id = slot.feedback_id AND f.id > 0
                AND f.selected_policy_id = s.policy_id AND f.selected_library_id = s.library_id
            LIMIT 1
        ) feedback ON TRUE
        LEFT JOIN libraries original ON original.id = feedback.top_suggestion_library_id
        ORDER BY slot.ordinality
    `, [suggestionId, afterPosition, PAGE_SIZE, MAX_SUGGESTION_EVIDENCE_REFERENCES]);

    if (!rows.length) throw new NotFoundError('Suggestion not found');

    const { reference_count: referenceCount } = rows[0];
    const items = rows[0].position === null ? [] : rows.map(projectSlot);
    const last = items.at(-1);
    const page = {
        suggestionId,
        referenceCount,
        items,
        nextAfterPosition: last && last.position < referenceCount ? last.position : null,
    };
    const body = JSON.stringify(page);
    if (Buffer.byteLength(body) > MAX_PAGE_BYTES) throw new Error('Suggestion evidence page exceeded its response limit');
    return body;
}

function projectSlot(row) {
    const { position } = row;
    if (row.feedback_id === null) return { position, status: 'unavailable' };

    const promptedAt = row.prompted_at instanceof Date && Number.isFinite(row.prompted_at.getTime())
        ? row.prompted_at.toISOString() : null;
    return {
        position,
        status: 'available',
        feedbackId: row.feedback_id,
        title: row.title,
        promptedAt,
        wasCorrection: row.was_correction,
        originalLibrary: row.original_library,
        selectedLibrary: row.selected_library,
    };
}
