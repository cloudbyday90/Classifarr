/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as metadataEnrichment from '../utils/metadataEnrichment.mjs';
import { getClassificationQueueSummary } from './classificationQueueStatsService.mjs';
import { safeParseInt } from '../utils/queueHelpers.mjs';

const GAP_ANALYSIS_BATCH_SIZE = 500;
const GAP_ANALYSIS_INTERVAL_MINUTES = 5;

export class QueueReadModel {
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
        this.getSyncStatus = deps.getSyncStatus || (() => ({
            isRunning: false,
            type: null,
            progress: 0,
            currentLibrary: null,
            startedAt: null,
            duration: 0,
            canInterrupt: true,
        }));
        this.enrichmentRetryService = deps.enrichmentRetryService || null;
        this.metadataEnrichment = deps.metadataEnrichment || metadataEnrichment;
    }

    async getStats() {
        try {
            const blockers = await this.getDispatchBlockers();
            const stats = await getClassificationQueueSummary(this.db);

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

    async getLibrarySyncStats() {
        try {
            const result = await this.db.query(`
                WITH latest_sync AS (
                    SELECT DISTINCT ON (library_id)
                        library_id,
                        status,
                        COALESCE(items_total, 0) AS items_total,
                        COALESCE(items_processed, 0) AS items_processed
                    FROM media_server_sync_status
                    WHERE library_id IS NOT NULL
                    ORDER BY library_id, created_at DESC, id DESC
                )
                SELECT
                    COALESCE((SELECT COUNT(*) FROM media_server_items), 0) AS synced_items,
                    COALESCE(SUM(GREATEST(items_total, items_processed)), 0) AS total_items,
                    COUNT(*) FILTER (WHERE status = 'running') AS running_libraries,
                    COUNT(*) AS tracked_libraries
                FROM latest_sync
            `);

            const syncRuntime = this.getSyncStatus();
            const syncedItems = safeParseInt(result.rows[0]?.synced_items);
            const latestKnownTotal = safeParseInt(result.rows[0]?.total_items);
            const totalItems = Math.max(latestKnownTotal, syncedItems);
            const runningLibraries = safeParseInt(result.rows[0]?.running_libraries);
            const trackedLibraries = safeParseInt(result.rows[0]?.tracked_libraries);
            const remainingItems = Math.max(totalItems - syncedItems, 0);
            const percentComplete = totalItems > 0 ? Math.round((syncedItems / totalItems) * 100) : 100;

            return {
                syncedItems,
                totalItems,
                remainingItems,
                percentComplete,
                isRunning: syncRuntime?.isRunning === true,
                type: syncRuntime?.type || null,
                progress: safeParseInt(syncRuntime?.progress),
                currentLibrary: syncRuntime?.currentLibrary || null,
                startedAt: syncRuntime?.startedAt || null,
                duration: safeParseInt(syncRuntime?.duration),
                canInterrupt: syncRuntime?.canInterrupt !== false,
                runningLibraries,
                trackedLibraries,
            };
        } catch (error) {
            this.logger.error('Failed to get library sync stats', { error: error.message });
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
        const [queueStats, gapStats, librarySyncStats, todayResult, enrichmentResult, enrichmentQueueResult] = await Promise.all([
            this.getStats(),
            this.getGapAnalysisStats(),
            this.getLibrarySyncStats(),
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
                    COUNT(*) FILTER (WHERE enrichment_status = 'completed') as completed_items,
                    COUNT(*) FILTER (WHERE enrichment_status = 'processing') as processing_items,
                    COUNT(*) FILTER (WHERE enrichment_status = 'pending') as pending_items,
                    COUNT(*) FILTER (WHERE enrichment_status = 'deferred') as deferred_items,
                    COUNT(*) FILTER (WHERE enrichment_status = 'failed') as failed_items,
                    COUNT(*) FILTER (WHERE enrichment_provider_state IN ('omdb', 'omdb+tavily')) as omdb_enriched,
                    COUNT(*) FILTER (WHERE enrichment_provider_state IN ('tavily', 'omdb+tavily')) as tavily_enriched
                FROM media_server_items
            `),
            this.db.query(`
                SELECT COUNT(*) as pending FROM task_queue 
                WHERE task_type = 'metadata_enrichment' AND status = 'pending'
            `)
        ]);

        const enrichmentPending = parseInt(enrichmentQueueResult.rows[0]?.pending, 10) || 0;
        const totalItems = parseInt(enrichmentResult.rows[0]?.total_items, 10) || 0;
        const completedItems = parseInt(enrichmentResult.rows[0]?.completed_items, 10) || 0;
        const processingItems = parseInt(enrichmentResult.rows[0]?.processing_items, 10) || 0;
        const pendingItems = parseInt(enrichmentResult.rows[0]?.pending_items, 10) || 0;
        const deferredItems = parseInt(enrichmentResult.rows[0]?.deferred_items, 10) || 0;
        const failedItems = parseInt(enrichmentResult.rows[0]?.failed_items, 10) || 0;
        const tavilyEnrichedItems = parseInt(enrichmentResult.rows[0]?.tavily_enriched, 10) || 0;
        const omdbEnrichedItems = parseInt(enrichmentResult.rows[0]?.omdb_enriched, 10) || 0;
        const enrichmentProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        const coreEnrichmentProgress = totalItems > 0 ? Math.round((omdbEnrichedItems / totalItems) * 100) : 0;
        const newClassifiedToday = parseInt(todayResult.rows[0]?.new_classified, 10) || 0;
        const allClassifiedToday = parseInt(todayResult.rows[0]?.all_classified, 10) || 0;
        const newAvgConfidence = parseFloat(todayResult.rows[0]?.new_avg_confidence) || 0;
        const allAvgConfidence = parseFloat(todayResult.rows[0]?.all_avg_confidence) || 0;

        let retryQueueStats = {
            tavily: { pending: 0, deferred: 0, actionablePending: 0 },
            omdb: { pending: 0, deferred: 0, actionablePending: 0 },
            total: { pending: 0, deferred: 0, actionablePending: 0 }
        };
        if (this.enrichmentRetryService) {
            try {
                retryQueueStats = await this.enrichmentRetryService.getStats();
            } catch (_error) {
                // Retry queue table may not exist yet
            }
        }
        const retryQueueActionablePending = safeParseInt(retryQueueStats?.total?.actionablePending);
        const retryQueueDeferred = safeParseInt(retryQueueStats?.total?.deferred);

        return {
            queue: queueStats,
            gapAnalysis: gapStats,
            librarySync: librarySyncStats,
            today: {
                classified: newClassifiedToday,
                avgConfidence: Math.round(newAvgConfidence),
                allClassified: allClassifiedToday,
                allAvgConfidence: Math.round(allAvgConfidence)
            },
            enrichment: {
                totalItems,
                tavilyEnriched: tavilyEnrichedItems,
                omdbEnriched: omdbEnrichedItems,
                progress: enrichmentProgress,
                coreProgress: coreEnrichmentProgress,
                pending: enrichmentPending,
                actionablePending: enrichmentPending + retryQueueActionablePending,
                completedItems,
                processingItems,
                pendingItems,
                deferredItems: deferredItems || retryQueueDeferred,
                failedItems,
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
