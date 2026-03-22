/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const GAP_ANALYSIS_BATCH_SIZE = 500;
const GAP_ANALYSIS_INTERVAL_MINUTES = 5;

function toCount(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

class QueueReadModel {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.getDispatchBlockers = deps.getDispatchBlockers || (async () => ({
            hasProcessingClassification: false,
            lookupFailed: false,
        }));
        this.getRuntimeState = deps.getRuntimeState || (() => ({
            aiAvailable: false,
            workerRunning: false,
        }));
    }

    async getStats() {
        try {
            const blockers = await this.getDispatchBlockers();
            const result = await this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'processing') AS processing,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed
        FROM task_queue
        WHERE task_type = 'classification'
      `);

            const stats = {
                pending: toCount(result.rows[0]?.pending),
                processing: toCount(result.rows[0]?.processing),
                completed: toCount(result.rows[0]?.completed),
                failed: toCount(result.rows[0]?.failed),
                total: 0,
            };

            stats.total = stats.pending + stats.processing + stats.completed + stats.failed;

            const runtimeState = this.getRuntimeState();
            stats.aiAvailable = runtimeState.aiAvailable;
            stats.workerRunning = runtimeState.workerRunning;
            stats.classificationPaused = Boolean(blockers.lookupFailed);
            stats.classificationPauseReason = blockers.lookupFailed
                ? 'dispatch_check_failed'
                : null;

            return stats;
        } catch (error) {
            this.logger.error('Failed to get queue stats', { error: error.message });
            throw error;
        }
    }

    async getGapAnalysisStats() {
        try {
            const unprocessedResult = await this.db.query(`
                SELECT COUNT(*) as count
                FROM media_server_items
                WHERE metadata->'content_analysis' IS NULL
            `);

            const totalResult = await this.db.query(`
                SELECT COUNT(*) as count FROM media_server_items
            `);

            const unprocessedCount = toCount(unprocessedResult.rows[0]?.count);
            const totalCount = toCount(totalResult.rows[0]?.count);
            const processedCount = totalCount - unprocessedCount;
            const batchesRemaining = Math.ceil(unprocessedCount / GAP_ANALYSIS_BATCH_SIZE);
            const estimatedMinutesRemaining = batchesRemaining * GAP_ANALYSIS_INTERVAL_MINUTES;

            return {
                unprocessedCount,
                processedCount,
                totalCount,
                percentComplete: totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 100,
                batchSize: GAP_ANALYSIS_BATCH_SIZE,
                batchesRemaining,
                intervalMinutes: GAP_ANALYSIS_INTERVAL_MINUTES,
                estimatedMinutesRemaining,
                estimatedCompletion: estimatedMinutesRemaining > 0
                    ? `~${estimatedMinutesRemaining} min (${batchesRemaining} batches)`
                    : 'Complete'
            };
        } catch (error) {
            this.logger.error('Failed to get gap analysis stats', { error: error.message });
            throw error;
        }
    }

    async getPendingTasks(limit = 20) {
        try {
            const result = await this.db.query(
                `SELECT id, task_type, status, priority, attempts, max_attempts,
                error_message, source, created_at, next_retry_at,
                payload
         FROM task_queue
         WHERE status IN ('pending', 'processing')
         ORDER BY priority DESC, created_at ASC
         LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error) {
            this.logger.error('Failed to get pending tasks', { error: error.message });
            throw error;
        }
    }

    async getFailedTasks(limit = 20) {
        try {
            const result = await this.db.query(
                `SELECT id, task_type, status, priority, attempts, max_attempts,
                error_message, source, created_at, completed_at,
                payload
         FROM task_queue
         WHERE status = 'failed'
         ORDER BY completed_at DESC
         LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error) {
            this.logger.error('Failed to get failed tasks', { error: error.message });
            throw error;
        }
    }
}

module.exports = { QueueReadModel };
