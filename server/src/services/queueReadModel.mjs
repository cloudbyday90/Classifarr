/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import metadataEnrichment from '../utils/metadataEnrichment.mjs';
import { createResolvedLoader, loadResolvedDependency } from './shared/resolvedLoader.mjs';
import { safeParseInt } from '../utils/queueHelpers.mjs';

const GAP_ANALYSIS_BATCH_SIZE = 500;
const GAP_ANALYSIS_INTERVAL_MINUTES = 5;

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
        this.enrichmentRetryService = deps.enrichmentRetryService || null;
        this.metadataEnrichment = deps.metadataEnrichment || metadataEnrichment;
        this.loadMetadataEnrichment = deps.loadMetadataEnrichment || createResolvedLoader(this.metadataEnrichment);
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
                pending: safeParseInt(result.rows[0]?.pending),
                processing: safeParseInt(result.rows[0]?.processing),
                completed: safeParseInt(result.rows[0]?.completed),
                failed: safeParseInt(result.rows[0]?.failed),
                total: 0,
            };

            stats.total = stats.pending + stats.processing + stats.completed + stats.failed;

            const runtimeState = this.getRuntimeState();
            const classificationPausedForAi = runtimeState.workerRunning === true && runtimeState.aiAvailable === false;
            stats.aiAvailable = runtimeState.aiAvailable;
            stats.workerRunning = runtimeState.workerRunning;
            stats.classificationPaused = Boolean(blockers.lookupFailed || classificationPausedForAi);
            stats.classificationPauseReason = blockers.lookupFailed
                ? 'dispatch_check_failed'
                : (classificationPausedForAi ? 'ai_unavailable' : null);

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

            const unprocessedCount = safeParseInt(unprocessedResult.rows[0]?.count);
            const totalCount = safeParseInt(totalResult.rows[0]?.count);
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

    async getLiveStats() {
        const {
            ENRICHMENT_METADATA_KEYS,
            TAVILY_METADATA_KEYS,
            buildJsonbPresenceOr
        } = await loadResolvedDependency(this.loadMetadataEnrichment);
        const anyEnrichmentSql = buildJsonbPresenceOr('metadata', ENRICHMENT_METADATA_KEYS);
        const tavilyEnrichmentSql = buildJsonbPresenceOr('metadata', TAVILY_METADATA_KEYS);
        const [queueStats, gapStats, todayResult, enrichmentResult, enrichmentQueueResult] = await Promise.all([
            this.getStats(),
            this.getGapAnalysisStats(),
            this.db.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE method != 'source_library') as new_classified,
                    COUNT(*) as all_classified,
                    AVG(confidence) FILTER (WHERE method != 'source_library') as new_avg_confidence,
                    AVG(confidence) as all_avg_confidence
                FROM classification_history 
                WHERE created_at >= CURRENT_DATE
            `),
            this.db.query(`
                SELECT 
                    COUNT(*) as total_items,
                    COUNT(*) FILTER (WHERE ${anyEnrichmentSql}) as enriched,
                    COUNT(*) FILTER (WHERE ${tavilyEnrichmentSql}) as tavily_enriched,
                    COUNT(*) FILTER (WHERE metadata->'omdb' IS NOT NULL) as omdb_enriched
                FROM media_server_items
            `),
            this.db.query(`
                SELECT COUNT(*) as pending FROM task_queue 
                WHERE task_type = 'metadata_enrichment' AND status = 'pending'
            `)
        ]);

        const enrichmentPending = parseInt(enrichmentQueueResult.rows[0]?.pending, 10) || 0;
        const totalItems = parseInt(enrichmentResult.rows[0]?.total_items, 10) || 0;
        const enrichedItems = parseInt(enrichmentResult.rows[0]?.enriched, 10) || 0;
        const tavilyEnrichedItems = parseInt(enrichmentResult.rows[0]?.tavily_enriched, 10) || 0;
        const omdbEnrichedItems = parseInt(enrichmentResult.rows[0]?.omdb_enriched, 10) || 0;
        const enrichmentProgress = totalItems > 0 ? Math.round((enrichedItems / totalItems) * 100) : 0;
        const newClassifiedToday = parseInt(todayResult.rows[0]?.new_classified, 10) || 0;
        const allClassifiedToday = parseInt(todayResult.rows[0]?.all_classified, 10) || 0;
        const newAvgConfidence = parseFloat(todayResult.rows[0]?.new_avg_confidence) || 0;
        const allAvgConfidence = parseFloat(todayResult.rows[0]?.all_avg_confidence) || 0;

        let retryQueueStats = { tavily: { pending: 0 }, total: { pending: 0 } };
        if (this.enrichmentRetryService) {
            try {
                retryQueueStats = await this.enrichmentRetryService.getStats();
            } catch (_error) {
                // Retry queue table may not exist yet
            }
        }

        return {
            queue: queueStats,
            gapAnalysis: gapStats,
            today: {
                classified: newClassifiedToday,
                avgConfidence: Math.round(newAvgConfidence),
                allClassified: allClassifiedToday,
                allAvgConfidence: Math.round(allAvgConfidence)
            },
            enrichment: {
                totalItems,
                enriched: enrichedItems,
                tavilyEnriched: tavilyEnrichedItems,
                omdbEnriched: omdbEnrichedItems,
                progress: enrichmentProgress,
                pending: enrichmentPending,
                retryQueue: retryQueueStats
            },
            health: {
                ai: queueStats?.aiAvailable ?? false,
                worker: queueStats?.workerRunning ?? false,
                database: true
            },
            timestamp: new Date().toISOString()
        };
    }
}

export { QueueReadModel };
