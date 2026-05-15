/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { safeParseInt } from '../utils/queueHelpers.mjs';

export const SUCCESSFUL_CLASSIFICATION_STATUSES = Object.freeze([
    'completed',
    'corrected',
    'verified',
    'reclassified',
    'routed',
]);

function computeSuccessRate(completed, failed) {
    const terminalTotal = completed + failed;
    if (terminalTotal <= 0) {
        return 100;
    }

    return Math.round((completed / terminalTotal) * 1000) / 10;
}

async function getActiveClassificationTaskCounts(db) {
    const result = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'processing') AS processing
        FROM task_queue
        WHERE task_type = 'classification'
    `);

    return {
        pending: safeParseInt(result.rows[0]?.pending),
        processing: safeParseInt(result.rows[0]?.processing),
    };
}

async function getClassificationOutcomeTotals(db) {
    const result = await db.query(`
        SELECT successful_count, failed_count
        FROM classification_history_totals
        WHERE singleton = TRUE
    `);

    return {
        completed: safeParseInt(result.rows[0]?.successful_count),
        failed: safeParseInt(result.rows[0]?.failed_count),
    };
}

async function getRecentCompletedCount(db, recentWindow = '24 hours') {
    const result = await db.query(
        `
            SELECT COUNT(*) AS completed_recent
            FROM classification_history
            WHERE status = ANY($1::text[])
              AND created_at > NOW() - $2::interval
        `,
        [SUCCESSFUL_CLASSIFICATION_STATUSES, recentWindow]
    );

    return safeParseInt(result.rows[0]?.completed_recent);
}

export async function getClassificationQueueSummary(db) {
    const [activeCounts, outcomeTotals] = await Promise.all([
        getActiveClassificationTaskCounts(db),
        getClassificationOutcomeTotals(db),
    ]);

    const total = activeCounts.pending + activeCounts.processing + outcomeTotals.completed + outcomeTotals.failed;

    return {
        pending: activeCounts.pending,
        processing: activeCounts.processing,
        completed: outcomeTotals.completed,
        failed: outcomeTotals.failed,
        total,
    };
}

export async function getClassificationQueueHealth(db, options = {}) {
    const recentWindow = options.recentWindow || '24 hours';
    const [activeCounts, outcomeTotals, completedToday] = await Promise.all([
        getActiveClassificationTaskCounts(db),
        getClassificationOutcomeTotals(db),
        getRecentCompletedCount(db, recentWindow),
    ]);

    return {
        pending: activeCounts.pending,
        processing: activeCounts.processing,
        completed_today: completedToday,
        failed: outcomeTotals.failed,
        total: activeCounts.pending + activeCounts.processing + outcomeTotals.completed + outcomeTotals.failed,
        success_rate: computeSuccessRate(outcomeTotals.completed, outcomeTotals.failed),
    };
}
