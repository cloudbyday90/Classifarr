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
        const summary = await client.query('SELECT * FROM policy_feedback_learning_stats WHERE policy_id = $1', [policyId]);
        const stats = summary.rows[0];
        if (!stats) return null;
        const { total_decisions, auto_classified, ai_validated, user_prompted, user_corrections,
            accuracy_rate, auto_accuracy_rate, last_7_days_accuracy, last_30_days_accuracy,
            trend, last_decision_at, last_correction_at } = stats;

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
            accuracy_rate: accuracy_rate === null ? null : (accuracy_rate * 100).toFixed(1) + '%',
            evaluated_decisions: stats.evaluated_decisions,
            trend
        });

        return { ...result.rows[0], ...stats };
    });
}
