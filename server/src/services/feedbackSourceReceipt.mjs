/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ConflictError } from '../utils/appError.mjs';

export function feedbackRequestFingerprint(normalizedRequest) {
    return createHash('sha256').update(JSON.stringify(normalizedRequest)).digest('hex');
}

function sourceConflict() {
    return new ConflictError('Feedback has already been recorded for this classification', { code: 'FEEDBACK_SOURCE_CONFLICT' });
}

export async function readFeedbackSourceReplay(client, classificationId, fingerprint) {
    const receipt = (await client.query('SELECT * FROM policy_feedback_sources WHERE classification_id=$1', [classificationId])).rows[0];
    if (!receipt) return null;
    if (receipt.intake !== 'standalone' || receipt.request_fingerprint !== fingerprint) throw sourceConflict();
    if (receipt.feedback_id == null) {
        throw new ConflictError('The recorded feedback is no longer available', { code: 'FEEDBACK_RESULT_UNAVAILABLE' });
    }
    return { feedbackId: receipt.feedback_id, replayed: true };
}

export async function assertFeedbackSourceUnused(client, classificationId) {
    if ((await client.query('SELECT 1 FROM policy_feedback_sources WHERE classification_id=$1', [classificationId])).rows.length) {
        throw sourceConflict();
    }
}

// Caller holds the source history lock; the receipt and feedback share its transaction.
export async function recordFeedbackSource(client, { classificationId, feedbackId, intake, fingerprint }) {
    try {
        await client.query(`INSERT INTO policy_feedback_sources(classification_id,feedback_id,intake,request_fingerprint)
            VALUES($1,$2,$3,$4)`, [classificationId, feedbackId, intake, fingerprint]);
    } catch (error) {
        if (error.code === '23505') throw sourceConflict();
        throw error;
    }
}
