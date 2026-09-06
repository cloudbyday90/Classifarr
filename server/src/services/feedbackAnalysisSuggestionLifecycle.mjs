/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError, ValidationError } from '../utils/appError.mjs';
import { lockPolicyAuthorityForWrite } from './policyLegacyWriteGuard.mjs';

function notPending(suggestionId) {
    return new ConflictError('Suggestion is no longer pending. Refresh the suggestions list.', {
        code: 'SUGGESTION_NOT_PENDING', suggestionId
    });
}

/** Caller owns a transaction. Lock policy before suggestion, matching storage and policy writes. */
export async function lockPendingSuggestion(client, suggestionId) {
    await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    const location = await client.query('SELECT policy_id FROM policy_tuning_suggestions WHERE id = $1', [suggestionId]);
    if (location.rows.length === 0) throw new NotFoundError('Suggestion not found');
    const policyId = location.rows[0].policy_id;
    const policy = await lockPolicyAuthorityForWrite({ client, policyId });
    const result = await client.query('SELECT * FROM policy_tuning_suggestions WHERE id = $1 FOR UPDATE', [suggestionId]);
    const suggestion = result.rows[0];
    if (!suggestion) throw new NotFoundError('Suggestion not found');
    if (suggestion.policy_id !== policyId) {
        throw new ConflictError('Suggestion policy changed. Refresh the suggestions list.', {
            code: 'SUGGESTION_POLICY_CHANGED', suggestionId
        });
    }
    if (suggestion.status !== 'pending') throw notPending(suggestionId);
    return { suggestion, policy };
}

/** Complete a locked review in the same transaction as its effects and audit entry. */
export async function completeSuggestionReview(client, { suggestionId, userId, status, reason = null, beforeAccuracy = null }) {
    if (!['applied', 'rejected'].includes(status)) throw new ValidationError('Invalid suggestion review status');
    const result = await client.query(`
        UPDATE policy_tuning_suggestions
        SET status = $2::text, reviewed_at = NOW(), reviewed_by = $3,
            rejection_reason = CASE WHEN $2 = 'rejected' THEN $4 ELSE rejection_reason END,
            before_accuracy = CASE WHEN $2 = 'applied' THEN $5 ELSE before_accuracy END,
            applied_at = CASE WHEN $2 = 'applied' THEN NOW() ELSE applied_at END,
            applied_by = CASE WHEN $2 = 'applied' THEN $3 ELSE applied_by END
        WHERE id = $1 AND status = 'pending'
        RETURNING id
    `, [suggestionId, status, userId, reason, beforeAccuracy]);
    if (result.rows.length !== 1) throw notPending(suggestionId);
}
