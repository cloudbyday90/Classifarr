/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError, ValidationError } from '../utils/appError.mjs';
import { normalizeStandaloneFeedback } from './standaloneFeedbackInput.mjs';
import { feedbackRequestFingerprint, readFeedbackSourceReplay } from './feedbackSourceReceipt.mjs';
import { writeStandaloneFeedback } from './standaloneFeedbackWriter.mjs';

export async function recordStandaloneFeedback({ db, feedbackAnalysis, body }) {
    const input = normalizeStandaloneFeedback(body);
    const fingerprint = feedbackRequestFingerprint(input);
    return db.withTransaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        const replay = await readFeedbackSourceReplay(client, input.classification_id, fingerprint);
        if (replay) return replay;
        // Same policy -> library -> history order as prompt persistence.
        const policy = (await client.query('SELECT id,library_id FROM library_policies WHERE id=$1 FOR UPDATE', [input.selected_policy_id])).rows[0];
        const library = (await client.query('SELECT id,media_type,is_active FROM libraries WHERE id=$1 FOR SHARE', [input.selected_library_id])).rows[0];
        const classification = (await client.query(`SELECT id,tmdb_id,media_type,title,metadata,confidence,status,method,
            created_at AT TIME ZONE 'UTC' AS created_at FROM classification_history WHERE id=$1 FOR UPDATE`, [input.classification_id])).rows[0];
        // Another intake may have committed while we waited, including a prompt response.
        const concurrentReplay = await readFeedbackSourceReplay(client, input.classification_id, fingerprint);
        if (concurrentReplay) return concurrentReplay;
        if (!classification) throw new NotFoundError('Classification not found');
        if (!['completed', 'verified', 'routed'].includes(classification.status)) {
            throw new ConflictError('Feedback requires a completed classification; pending decisions use prompts', { code: 'FEEDBACK_SOURCE_NOT_READY' });
        }
        const createdAt = classification.created_at == null ? NaN : new Date(classification.created_at).getTime();
        if (!Number.isFinite(createdAt) || createdAt > Date.now()) {
            throw new ConflictError('Classification creation time is unavailable or invalid', { code: 'FEEDBACK_SOURCE_NOT_READY' });
        }
        if (!policy || policy.library_id !== input.selected_library_id || !library?.is_active || library.media_type !== classification.media_type) {
            throw new ValidationError('Selected policy must belong to an active library matching the classification media type');
        }
        return writeStandaloneFeedback(client, { feedbackAnalysis, input, classification, fingerprint });
    });
}
