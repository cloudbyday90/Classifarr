/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';

const logger = createLogger('FeedbackAnalysis');

export async function updateLearningStats(policyId, client = db) {
    return withServiceCatch(logger, 'Failed to update learning stats', { policyId }, async () => {
        const allFeedback = await client.query(`
            SELECT * FROM policy_feedback_log
            WHERE selected_policy_id = $1
            ORDER BY prompted_at DESC
        `, [policyId]);

        const feedback = allFeedback.rows;

        if (feedback.length === 0) {
            return null;
        }

        const total_decisions = feedback.length;
        const auto_classified = feedback.filter(f => f.prompt_type === 'auto_classify').length;
        const ai_validated = feedback.filter(f => f.prompt_type === 'ai_validate').length;
        const user_prompted = feedback.filter(f =>
            f.prompt_type === 'prompt_confirm' || f.prompt_type === 'prompt_select'
        ).length;
        const user_corrections = feedback.filter(f => f.was_correction).length;

        const accuracy_rate = total_decisions > 0
            ? (total_decisions - user_corrections) / total_decisions
            : 0;

        const auto_accuracy_rate = auto_classified > 0
            ? feedback.filter(f => f.prompt_type === 'auto_classify' && !f.was_correction).length / auto_classified
            : 0;

        const last7Days = feedback.filter(f => {
            const date = new Date(f.prompted_at);
            const now = new Date();
            const diffDays = (now - date) / (1000 * 60 * 60 * 24);
            return diffDays <= 7;
        });

        const last_7_days_accuracy = last7Days.length > 0
            ? last7Days.filter(f => !f.was_correction).length / last7Days.length
            : null;

        const last30Days = feedback.filter(f => {
            const date = new Date(f.prompted_at);
            const now = new Date();
            const diffDays = (now - date) / (1000 * 60 * 60 * 24);
            return diffDays <= 30;
        });

        const last_30_days_accuracy = last30Days.length > 0
            ? last30Days.filter(f => !f.was_correction).length / last30Days.length
            : null;

        let trend = 'stable';
        if (last_7_days_accuracy !== null && last_30_days_accuracy !== null) {
            if (last_7_days_accuracy > last_30_days_accuracy + 0.05) {
                trend = 'improving';
            } else if (last_7_days_accuracy < last_30_days_accuracy - 0.05) {
                trend = 'declining';
            }
        }

        const last_decision_at = feedback[0].prompted_at;
        const lastCorrection = feedback.find(f => f.was_correction);
        const last_correction_at = lastCorrection ? lastCorrection.prompted_at : null;

        const result = await client.query(`
            INSERT INTO policy_learning_stats (
                policy_id,
                total_decisions,
                auto_classified,
                ai_validated,
                user_prompted,
                user_corrections,
                accuracy_rate,
                auto_accuracy_rate,
                last_7_days_accuracy,
                last_30_days_accuracy,
                trend,
                last_decision_at,
                last_correction_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
            ON CONFLICT (policy_id) DO UPDATE SET
                total_decisions = EXCLUDED.total_decisions,
                auto_classified = EXCLUDED.auto_classified,
                ai_validated = EXCLUDED.ai_validated,
                user_prompted = EXCLUDED.user_prompted,
                user_corrections = EXCLUDED.user_corrections,
                accuracy_rate = EXCLUDED.accuracy_rate,
                auto_accuracy_rate = EXCLUDED.auto_accuracy_rate,
                last_7_days_accuracy = EXCLUDED.last_7_days_accuracy,
                last_30_days_accuracy = EXCLUDED.last_30_days_accuracy,
                trend = EXCLUDED.trend,
                last_decision_at = EXCLUDED.last_decision_at,
                last_correction_at = EXCLUDED.last_correction_at,
                updated_at = NOW()
            RETURNING *
        `, [
            policyId,
            total_decisions,
            auto_classified,
            ai_validated,
            user_prompted,
            user_corrections,
            accuracy_rate,
            auto_accuracy_rate,
            last_7_days_accuracy,
            last_30_days_accuracy,
            trend,
            last_decision_at,
            last_correction_at
        ]);

        logger.info('Learning stats updated', {
            policyId,
            accuracy_rate: (accuracy_rate * 100).toFixed(1) + '%',
            trend
        });

        return result.rows[0];
    });
}
