/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { cohortDigest, suggestionEvidenceDigest } from '../../services/feedbackAnalysisCohortContract.mjs';

export async function seedSuggestionFeedback(db, policyId, libraryId, count = 10) {
    const { rows: candidates } = await db.query(`SELECT id FROM libraries
        WHERE id <> $1 AND is_active IS TRUE AND media_type=(SELECT media_type FROM libraries WHERE id=$1)
        ORDER BY id LIMIT 1`, [libraryId]);
    const otherId = candidates[0]?.id;
    if (!otherId) throw new Error('Suggestion fixture requires a second active library for correction evidence');
    const { rows } = await db.query(`INSERT INTO policy_feedback_log(tmdb_id, selected_policy_id,
        selected_library_id, was_correction, item_metadata, original_scores, prompt_type, top_suggestion_score, prompted_at, top_suggestion_library_id)
        SELECT n, $1, $2, n % 2 = 0, '{"genres":["Action"]}', '{"preset":85}', 'auto_classify', 85,
            NOW() - INTERVAL '1 minute', CASE WHEN n % 2 = 0 THEN $4::integer ELSE $2::integer END
            FROM generate_series(1,$3::integer) n RETURNING id`, [policyId, libraryId, count, otherId]);
    return rows.map(row => row.id);
}

export async function attachSuggestionCohort(db, suggestionId, manifest) {
    const fingerprint = cohortDigest(manifest);
    await db.query(`INSERT INTO policy_tuning_cohorts(fingerprint,policy_id,manifest) VALUES($1,$2,$3)
        ON CONFLICT DO NOTHING`, [fingerprint, manifest.policy.id, manifest]);
    const { rows: [suggestion] } = await db.query('SELECT * FROM policy_tuning_suggestions WHERE id=$1', [suggestionId]);
    const support = suggestion.supporting_feedback_ids || [];
    await db.query(`UPDATE policy_tuning_suggestions SET cohort_fingerprint=$1,evidence_fingerprint=$2,
        supporting_feedback_ids=$3 WHERE id=$4`, [fingerprint, suggestionEvidenceDigest(fingerprint,
        suggestion.suggestion_type, suggestion.suggestion_config, support), support, suggestionId]);
}
