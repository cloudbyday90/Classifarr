/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { NotFoundError, ValidationError, ConflictError } from '../utils/appError.mjs';
import { readEligiblePolicyFeedback } from './feedbackAnalysisEvidence.mjs';
import { isLearningLibraryId } from './autoLearningFeedbackEvidence.mjs';
import {
    COHORT_VERSION, MAX_COHORT_ROWS, assertCohortShape, canonicalCohortJson,
    cohortDigest, evidenceConflict, projectDestination, projectFeedback, projectPolicy,
    suggestionEvidenceDigest,
} from './feedbackAnalysisCohortContract.mjs';

/** Capture once, before analysis; never reconstruct provenance from a later read. */
export async function captureSuggestionCohort(policyId, days = 30) {
    if (!isLearningLibraryId(policyId) || !Number.isInteger(days) || days < 1 || days > 365) {
        throw new ValidationError('A valid policy and analysis period of 1–365 days are required');
    }
    return db.withTransaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        const { rows: policies } = await client.query('SELECT * FROM library_policies WHERE id = $1', [policyId]);
        if (!policies[0]) throw new NotFoundError('Policy not found');
        const { rows: destinations } = await client.query('SELECT * FROM libraries WHERE id = $1', [policies[0].library_id]);
        const { rows: times } = await client.query('SELECT NOW() AS captured_at');
        const capturedAt = times[0].captured_at.toISOString();
        const feedback = await readEligiblePolicyFeedback(client, policyId, days, {
            capturedAt, limit: MAX_COHORT_ROWS + 1,
        });
        if (feedback.length > MAX_COHORT_ROWS) {
            throw new ValidationError('Feedback cohort exceeds 5,000 rows. Use a shorter analysis period.', { code: 'SUGGESTION_COHORT_TOO_LARGE' });
        }
        const manifest = {
            version: COHORT_VERSION, captured_at: capturedAt, days,
            policy: projectPolicy(policies[0]), destination: projectDestination(destinations[0]),
            feedback: feedback.map(projectFeedback),
        };
        if (feedback.length > 0) assertCohortShape(manifest);
        // A detached/inactive destination produces the existing insufficient-feedback result.
        return JSON.parse(canonicalCohortJson(manifest));
    });
}

/** Caller holds the policy lock. NOWAIT prevents an inverse dependency-lock wait. */
export async function assertSuggestionCohortCurrent(client, manifest, policy) {
    assertCohortShape(manifest);
    if (cohortDigest(projectPolicy(policy)) !== cohortDigest(manifest.policy)) throw evidenceConflict();
    try {
        const { rows: libraries } = await client.query('SELECT * FROM libraries WHERE id = $1 FOR SHARE NOWAIT', [policy.library_id]);
        const library = libraries[0];
        if (!library?.is_active || cohortDigest(projectDestination(library)) !== cohortDigest(manifest.destination)) throw evidenceConflict();
        const ids = manifest.feedback.map(row => row.id).sort((a, b) => a - b);
        const { rows } = await client.query(`
            SELECT id, selected_policy_id, selected_library_id, was_correction, item_metadata,
                original_scores, top_suggestion_library_id, top_suggestion_score, prompt_type, prompted_at
            FROM policy_feedback_log WHERE id = ANY($1::integer[])
            ORDER BY id FOR SHARE NOWAIT
        `, [ids]);
        const { rows: times } = await client.query('SELECT clock_timestamp() AS checked_at');
        const now = times[0].checked_at.getTime();
        const lowerBound = now - manifest.days * 86400000;
        if (Date.parse(manifest.captured_at) > now || rows.length !== ids.length
            || rows.some(row => row.selected_policy_id !== policy.id || row.selected_library_id !== library.id
                || !row.prompted_at || new Date(row.prompted_at).getTime() < lowerBound
                || new Date(row.prompted_at).getTime() > Date.parse(manifest.captured_at))
            || cohortDigest(rows.map(projectFeedback)) !== cohortDigest([...manifest.feedback].sort((a, b) => a.id - b.id))) {
            throw evidenceConflict();
        }
    } catch (error) {
        if (error.code === '55P03') {
            throw new ConflictError('Suggestion evidence is being updated. Refresh and try again later.', { code: 'SUGGESTION_EVIDENCE_BUSY' });
        }
        throw error;
    }
}

/** Validate both attribution and current input before any application effects. */
export async function assertSuggestionEvidenceCurrent(client, suggestion, policy, checkedCohorts = new Set()) {
    if (!suggestion.cohort_fingerprint || !suggestion.evidence_fingerprint) throw evidenceConflict('SUGGESTION_EVIDENCE_REQUIRED');
    const { rows } = await client.query('SELECT policy_id, manifest FROM policy_tuning_cohorts WHERE fingerprint = $1', [suggestion.cohort_fingerprint]);
    const cohort = rows[0];
    if (!cohort || cohort.policy_id !== policy.id || cohortDigest(cohort.manifest) !== suggestion.cohort_fingerprint
        || suggestionEvidenceDigest(suggestion.cohort_fingerprint, suggestion.suggestion_type,
            suggestion.suggestion_config, suggestion.supporting_feedback_ids) !== suggestion.evidence_fingerprint) throw evidenceConflict();
    if (!checkedCohorts.has(suggestion.cohort_fingerprint)) {
        await assertSuggestionCohortCurrent(client, cohort.manifest, policy);
        checkedCohorts.add(suggestion.cohort_fingerprint);
    }
}

export async function persistSuggestionCohort(client, policyId, manifest) {
    const fingerprint = cohortDigest(manifest);
    await client.query(`INSERT INTO policy_tuning_cohorts(fingerprint, policy_id, manifest)
        VALUES($1, $2, $3::jsonb) ON CONFLICT (fingerprint) DO NOTHING`, [fingerprint, policyId, canonicalCohortJson(manifest)]);
    return fingerprint;
}
