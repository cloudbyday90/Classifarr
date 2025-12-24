/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const classificationService = require('./classification');
const ollamaService = require('./ollama');

const logger = createLogger('QueueService');

// Configuration
const POLL_INTERVAL_MS = 5000;  // Check queue every 5 seconds
const MAX_CONCURRENT = 1;       // Process one at a time to avoid overloading Ollama
const RETRY_DELAYS = [30, 60, 120, 300, 600]; // Seconds: 30s, 1m, 2m, 5m, 10m

class QueueService {
    constructor() {
        this.running = false;
        this.processing = 0;
        this.ollamaAvailable = true;
    }

    /**
     * Add a task to the queue
     */
    async enqueue(taskType, payload, options = {}) {
        const { priority = 0, webhookLogId = null, source = 'webhook', maxAttempts = 5 } = options;

        try {
            const result = await db.query(
                `INSERT INTO task_queue (task_type, payload, priority, webhook_log_id, source, max_attempts)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
                [taskType, JSON.stringify(payload), priority, webhookLogId, source, maxAttempts]
            );

            const taskId = result.rows[0].id;
            logger.info('Task enqueued', { taskId, taskType, source });
            return taskId;
        } catch (error) {
            logger.error('Failed to enqueue task', { error: error.message, taskType });
            throw error;
        }
    }

    /**
     * Get the next pending task
     */
    async dequeue() {
        try {
            const result = await db.query(
                `UPDATE task_queue
         SET status = 'processing', started_at = NOW()
         WHERE id = (
           SELECT id FROM task_queue
           WHERE status = 'pending' AND next_retry_at <= NOW()
           ORDER BY priority DESC, created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`
            );

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to dequeue task', { error: error.message });
            return null;
        }
    }

    /**
     * Mark task as completed
     */
    async completeTask(taskId, result = {}) {
        try {
            await db.query(
                `UPDATE task_queue
         SET status = 'completed', completed_at = NOW(), payload = payload || $2
         WHERE id = $1`,
                [taskId, JSON.stringify({ result })]
            );
            logger.info('Task completed', { taskId });
        } catch (error) {
            logger.error('Failed to complete task', { error: error.message, taskId });
        }
    }

    /**
     * Mark task as failed with retry logic
     */
    async failTask(taskId, errorMessage, currentAttempts, maxAttempts) {
        const nextAttempt = currentAttempts + 1;

        try {
            if (nextAttempt >= maxAttempts) {
                // Permanently failed
                await db.query(
                    `UPDATE task_queue
           SET status = 'failed', error_message = $2, attempts = $3, completed_at = NOW()
           WHERE id = $1`,
                    [taskId, errorMessage, nextAttempt]
                );
                logger.error('Task permanently failed', { taskId, attempts: nextAttempt });
            } else {
                // Schedule retry with exponential backoff
                const delaySeconds = RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)];
                await db.query(
                    `UPDATE task_queue
           SET status = 'pending', error_message = $2, attempts = $3,
               next_retry_at = NOW() + INTERVAL '${delaySeconds} seconds',
               started_at = NULL
           WHERE id = $1`,
                    [taskId, errorMessage, nextAttempt]
                );
                logger.warn('Task scheduled for retry', { taskId, attempt: nextAttempt, delaySeconds });
            }
        } catch (error) {
            logger.error('Failed to update task status', { error: error.message, taskId });
        }
    }



    /**
     * Check if Ollama is available
     */
    async checkOllamaAvailability() {
        try {
            const result = await ollamaService.testConnection();

            if (result.success) {
                if (!this.ollamaAvailable) {
                    logger.info('Ollama is now available');
                }
                this.ollamaAvailable = true;
                return true;
            } else {
                if (this.ollamaAvailable) {
                    logger.warn('Ollama is offline', { error: result.error });
                }
                this.ollamaAvailable = false;
                return false;
            }
        } catch (error) {
            if (this.ollamaAvailable) {
                logger.warn('Ollama is offline', { error: error.message });
            }
            this.ollamaAvailable = false;
            return false;
        }
    }

    /**
     * Process a single task
     */
    async processTask(task) {
        logger.info('Processing task', { taskId: task.id, taskType: task.task_type });

        try {
            switch (task.task_type) {
                case 'classification':
                    const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
                    const result = await classificationService.classify(payload);
                    await this.completeTask(task.id, result);

                    // If this was a gap analysis task for a specific item, update the item directly
                    if (payload.itemId && result.bestMatch) {
                        const newMetadata = {
                            content_analysis: {
                                type: result.bestMatch.type,
                                confidence: result.bestMatch.confidence,
                                detected_at: new Date().toISOString()
                            }
                        };

                        // We need to fetch the current metadata first to merge, or use jsonb_set
                        // Using a simple merge query here
                        await db.query(
                            `UPDATE media_server_items 
                             SET metadata = metadata || $1::jsonb
                             WHERE id = $2`,
                            [JSON.stringify(newMetadata), payload.itemId]
                        );
                    }

                    // Update webhook_log if linked
                    if (task.webhook_log_id) {
                        await db.query(
                            `UPDATE webhook_log SET processing_status = 'completed', 
               routed_to_library = $2, processing_time_ms = EXTRACT(EPOCH FROM (NOW() - $3)) * 1000
               WHERE id = $1`,
                            [task.webhook_log_id, result.library?.name, task.started_at]
                        );
                    }
                    break;

                case 'metadata_enrichment':
                    // Metadata enrichment is for items ALREADY in Plex libraries
                    // This is LEARNING data - we add content_analysis AND Tavily enrichment
                    const enrichPayload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
                    // IMPORTANT: Items here are ALREADY in Plex libraries
                    // They are 100% confidence - DO NOT re-classify with AI
                    // Just use source library info and enrich with Tavily for learning

                    // Build enrichment data - 100% confidence from source library
                    const enrichmentData = {
                        content_analysis: {
                            type: 'source_library',  // Already classified by library placement
                            confidence: 100,
                            detected_at: new Date().toISOString(),
                            source: 'metadata_enrichment',
                            source_library_id: enrichPayload.source_library_id,
                            source_library_name: enrichPayload.source_library_name
                        }
                    };

                    // Try to get Tavily web search enrichment if configured
                    try {
                        const tavilyConfig = await db.query('SELECT * FROM tavily_config WHERE is_active = true LIMIT 1');

                        if (tavilyConfig.rows.length > 0 && tavilyConfig.rows[0].api_key) {
                            const config = tavilyConfig.rows[0];
                            const tavilyService = require('./tavily');

                            const searchOptions = {
                                apiKey: config.api_key,
                                searchDepth: config.search_depth || 'basic',
                                maxResults: config.max_results || 3
                            };

                            // Get IMDB info for richer metadata
                            try {
                                const imdbResults = await tavilyService.searchIMDB(
                                    enrichPayload.title,
                                    enrichPayload.year,
                                    enrichPayload.media?.media_type || 'movie',
                                    searchOptions
                                );

                                if (imdbResults?.results?.length > 0) {
                                    enrichmentData.tavily_imdb = {
                                        fetched_at: new Date().toISOString(),
                                        results: imdbResults.results.slice(0, 2).map(r => ({
                                            url: r.url,
                                            title: r.title,
                                            snippet: r.content?.substring(0, 500)
                                        })),
                                        answer: imdbResults.answer
                                    };
                                }
                            } catch (imdbError) {
                                logger.debug('Tavily IMDB search failed', { error: imdbError.message });
                            }

                            // Get content advisory for better classification
                            try {
                                const advisoryResults = await tavilyService.getContentAdvisory(
                                    enrichPayload.title,
                                    enrichPayload.year,
                                    searchOptions
                                );

                                if (advisoryResults?.results?.length > 0) {
                                    enrichmentData.tavily_advisory = {
                                        fetched_at: new Date().toISOString(),
                                        content: advisoryResults.results[0]?.content?.substring(0, 1000),
                                        answer: advisoryResults.answer
                                    };
                                }
                            } catch (advisoryError) {
                                logger.debug('Tavily advisory search failed', { error: advisoryError.message });
                            }

                            // NEW: Get content type classification (documentary, stand-up, etc.)
                            try {
                                const contentTypeQuery = `${enrichPayload.title} ${enrichPayload.year} documentary OR stand-up OR comedy special OR animation site:imdb.com`;
                                const contentTypeResults = await tavilyService.search(contentTypeQuery, {
                                    ...searchOptions,
                                    includeDomains: ['imdb.com', 'wikipedia.org'],
                                    maxResults: 2
                                });
                                if (contentTypeResults?.answer) {
                                    enrichmentData.tavily_content_type = {
                                        fetched_at: new Date().toISOString(),
                                        answer: contentTypeResults.answer
                                    };
                                }
                            } catch (ctError) {
                                logger.debug('Tavily content type search failed', { error: ctError.message });
                            }

                            // NEW: Check if holiday/Christmas content
                            try {
                                const holidayQuery = `${enrichPayload.title} ${enrichPayload.year} Christmas OR holiday OR seasonal movie`;
                                const holidayResults = await tavilyService.search(holidayQuery, {
                                    ...searchOptions,
                                    includeDomains: ['imdb.com', 'wikipedia.org'],
                                    maxResults: 2
                                });
                                if (holidayResults?.answer) {
                                    enrichmentData.tavily_holiday = {
                                        fetched_at: new Date().toISOString(),
                                        answer: holidayResults.answer
                                    };
                                }
                            } catch (holidayError) {
                                logger.debug('Tavily holiday search failed', { error: holidayError.message });
                            }

                            // If anime is suspected, get anime-specific info
                            const isAnime = enrichPayload.original_language === 'ja' ||
                                (enrichPayload.genres || []).some(g => g.toLowerCase().includes('anime'));

                            if (isAnime) {
                                try {
                                    const animeResults = await tavilyService.searchAnimeInfo(
                                        enrichPayload.title,
                                        searchOptions
                                    );

                                    if (animeResults?.results?.length > 0) {
                                        enrichmentData.tavily_anime = {
                                            fetched_at: new Date().toISOString(),
                                            results: animeResults.results.slice(0, 2).map(r => ({
                                                url: r.url,
                                                title: r.title,
                                                snippet: r.content?.substring(0, 500)
                                            })),
                                            answer: animeResults.answer
                                        };
                                    }
                                } catch (animeError) {
                                    logger.debug('Tavily anime search failed', { error: animeError.message });
                                }
                            }
                        }
                    } catch (tavilyError) {
                        logger.warn('Tavily enrichment failed', { error: tavilyError.message });
                        // Continue without Tavily data
                    }

                    // Update the item's metadata with all enrichment data
                    if (enrichPayload.itemId) {
                        await db.query(
                            `UPDATE media_server_items 
                             SET metadata = metadata || $1::jsonb
                             WHERE id = $2`,
                            [JSON.stringify(enrichmentData), enrichPayload.itemId]
                        );

                        const hasTavily = !!(enrichmentData.tavily_imdb || enrichmentData.tavily_advisory || enrichmentData.tavily_content_type || enrichmentData.tavily_holiday);
                        logger.info('Metadata enrichment complete (no AI, from source library)', {
                            itemId: enrichPayload.itemId,
                            title: enrichPayload.title,
                            sourceLibrary: enrichPayload.source_library_name,
                            tavilyEnriched: hasTavily
                        });
                    }

                    await this.completeTask(task.id, {
                        enriched: true,
                        sourceLibrary: enrichPayload.source_library_name,
                        tavilyEnriched: !!(enrichmentData.tavily_imdb || enrichmentData.tavily_advisory)
                    });
                    break;

                default:
                    logger.warn('Unknown task type', { taskType: task.task_type });
                    await this.failTask(task.id, `Unknown task type: ${task.task_type}`, task.attempts, task.max_attempts);
            }
        } catch (error) {
            logger.error('Task processing failed', { taskId: task.id, error: error.message });
            await this.failTask(task.id, error.message, task.attempts, task.max_attempts);

            // Update webhook_log if linked
            if (task.webhook_log_id) {
                await db.query(
                    `UPDATE webhook_log SET processing_status = 'failed', error_message = $2 WHERE id = $1`,
                    [task.webhook_log_id, error.message]
                );
            }
        }
    }

    /**
     * Reset any tasks stuck in 'processing' state from previous runs
     * This handles zombie tasks left behind after crashes/restarts
     */
    async resetStaleProcessingTasks() {
        try {
            const result = await db.query(
                `UPDATE task_queue 
                 SET status = 'pending', started_at = NULL, 
                     error_message = 'Reset on startup - previous worker crashed'
                 WHERE status = 'processing'
                 RETURNING id`
            );

            if (result.rowCount > 0) {
                logger.warn('Reset stale processing tasks on startup', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id)
                });
            }
            return result.rowCount;
        } catch (error) {
            logger.error('Failed to reset stale tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Main worker loop
     */
    async startWorker() {
        if (this.running) {
            logger.warn('Worker already running');
            return;
        }

        // Solution A: Reset any zombie tasks from previous crashes
        await this.resetStaleProcessingTasks();

        this.running = true;
        logger.info('Queue worker started');

        while (this.running) {
            try {
                // Check if Ollama is available before processing
                const ollamaReady = await this.checkOllamaAvailability();

                if (ollamaReady && this.processing < MAX_CONCURRENT) {
                    const task = await this.dequeue();

                    if (task) {
                        this.processing++;
                        this.processTask(task).finally(() => {
                            this.processing--;
                        });
                    }
                }
            } catch (error) {
                logger.error('Worker loop error', { error: error.message });
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        logger.info('Queue worker stopped');
    }

    /**
     * Stop the worker
     */
    stopWorker() {
        this.running = false;
        logger.info('Queue worker stopping...');
    }

    /**
     * Get queue statistics
     */
    async getStats() {
        try {
            const result = await db.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM task_queue
        GROUP BY status
      `);

            const stats = {
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0,
                total: 0
            };

            for (const row of result.rows) {
                stats[row.status] = parseInt(row.count);
                stats.total += parseInt(row.count);
            }

            stats.ollamaAvailable = this.ollamaAvailable;
            stats.workerRunning = this.running;

            return stats;
        } catch (error) {
            logger.error('Failed to get queue stats', { error: error.message });
            return null;
        }
    }

    /**
     * Get gap analysis statistics for progress indicator
     */
    async getGapAnalysisStats() {
        try {
            // Count items that still need to be analyzed
            const unprocessedResult = await db.query(`
                SELECT COUNT(*) as count 
                FROM media_server_items 
                WHERE metadata->'content_analysis' IS NULL
            `);

            // Get total items count
            const totalResult = await db.query(`
                SELECT COUNT(*) as count FROM media_server_items
            `);

            const unprocessedCount = parseInt(unprocessedResult.rows[0].count) || 0;
            const totalCount = parseInt(totalResult.rows[0].count) || 0;
            const processedCount = totalCount - unprocessedCount;

            const batchSize = 500; // Matches scheduler.js LIMIT
            const batchesRemaining = Math.ceil(unprocessedCount / batchSize);
            const intervalMinutes = 5; // Gap analysis runs every 5 minutes
            const estimatedMinutesRemaining = batchesRemaining * intervalMinutes;

            return {
                unprocessedCount,
                processedCount,
                totalCount,
                percentComplete: totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 100,
                batchSize,
                batchesRemaining,
                intervalMinutes,
                estimatedMinutesRemaining,
                estimatedCompletion: estimatedMinutesRemaining > 0
                    ? `~${estimatedMinutesRemaining} min (${batchesRemaining} batches)`
                    : 'Complete'
            };
        } catch (error) {
            logger.error('Failed to get gap analysis stats', { error: error.message });
            return null;
        }
    }

    /**
     * Get pending tasks
     */
    async getPendingTasks(limit = 20) {
        try {
            const result = await db.query(
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
            logger.error('Failed to get pending tasks', { error: error.message });
            return [];
        }
    }

    /**
     * Get failed tasks
     */
    async getFailedTasks(limit = 20) {
        try {
            const result = await db.query(
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
            logger.error('Failed to get failed tasks', { error: error.message });
            return [];
        }
    }

    /**
     * Retry a failed task
     */
    async retryTask(taskId) {
        try {
            await db.query(
                `UPDATE task_queue
         SET status = 'pending', attempts = 0, error_message = NULL, next_retry_at = NOW()
         WHERE id = $1 AND status = 'failed'`,
                [taskId]
            );
            logger.info('Task queued for retry', { taskId });
            return true;
        } catch (error) {
            logger.error('Failed to retry task', { error: error.message, taskId });
            return false;
        }
    }

    /**
     * Cancel a pending task
     */
    async cancelTask(taskId) {
        try {
            await db.query(
                `UPDATE task_queue
         SET status = 'cancelled', completed_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
                [taskId]
            );
            logger.info('Task cancelled', { taskId });
            return true;
        } catch (error) {
            logger.error('Failed to cancel task', { error: error.message, taskId });
            return false;
        }
    }

    /**
     * Clear all completed tasks
     */
    async clearCompletedTasks() {
        try {
            const result = await db.query(
                `DELETE FROM task_queue WHERE status = 'completed' RETURNING id`
            );
            logger.info('Cleared completed tasks', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            logger.error('Failed to clear completed tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Clear all failed tasks
     */
    async clearFailedTasks() {
        try {
            const result = await db.query(
                `DELETE FROM task_queue WHERE status = 'failed' RETURNING id`
            );
            logger.info('Cleared failed tasks', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            logger.error('Failed to clear failed tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Retry all failed tasks
     */
    async retryAllFailedTasks() {
        try {
            const result = await db.query(
                `UPDATE task_queue
         SET status = 'pending', attempts = 0, error_message = NULL, next_retry_at = NOW()
         WHERE status = 'failed'
         RETURNING id`
            );
            logger.info('Retrying all failed tasks', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            logger.error('Failed to retry all tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Cancel all pending tasks
     */
    async cancelAllPendingTasks() {
        try {
            const result = await db.query(
                `UPDATE task_queue
         SET status = 'cancelled', completed_at = NOW()
         WHERE status = 'pending'
         RETURNING id`
            );
            logger.info('Cancelled all pending tasks', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            logger.error('Failed to cancel all tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Re-queue all completed classifications for reprocessing with updated rules
     */
    async reprocessCompleted() {
        try {
            // Get all completed items from classification history
            const historyResult = await db.query(
                `SELECT ch.id, ch.tmdb_id, ch.media_type, ch.title, ch.year, ch.metadata
                 FROM classification_history ch
                 WHERE ch.status = 'completed'`
            );

            let count = 0;
            for (const item of historyResult.rows) {
                // Parse metadata to get full info
                const metadata = typeof item.metadata === 'string'
                    ? JSON.parse(item.metadata)
                    : item.metadata || {};

                // Enqueue for re-classification
                await this.enqueue('classification', {
                    title: item.title,
                    overview: metadata.overview || '',
                    genres: metadata.genres || [],
                    keywords: metadata.keywords || [],
                    content_rating: metadata.certification,
                    original_language: metadata.original_language || 'en',
                    tmdb_id: item.tmdb_id,
                    media: { media_type: item.media_type || 'movie' }
                }, {
                    priority: 5,
                    source: 'reprocess'
                });
                count++;
            }

            logger.info('Queued completed items for reprocessing', { count });
            return count;
        } catch (error) {
            logger.error('Failed to reprocess completed', { error: error.message });
            throw error;
        }
    }

    /**
     * Clear all queue data and trigger fresh library sync
     */
    async clearAndResync() {
        try {
            logger.info('Starting clear and resync process...');

            // 1. Stop worker to prevent race conditions with active tasks
            const wasRunning = this.running;
            if (wasRunning) {
                this.stopWorker();
                // Give it a moment to finish current iteration
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 2. Clear task queue
            const queueResult = await db.query('DELETE FROM task_queue RETURNING id');

            // 3. Clear content_analysis_log first (references classification_history)
            await db.query('DELETE FROM content_analysis_log');

            // 4. Clear classification history
            const historyResult = await db.query('DELETE FROM classification_history RETURNING id');

            // 4. Clear learning patterns and corrections (full reset)
            const patternsResult = await db.query('DELETE FROM learning_patterns RETURNING id');
            const correctionsResult = await db.query('DELETE FROM classification_corrections RETURNING id');

            // 5. Clear ALL library classification rules
            const rulesV2Result = await db.query('DELETE FROM library_rules_v2 RETURNING id');
            await db.query('DELETE FROM library_custom_rules');

            // 6. DELETE all media_server_items entirely (sync will repopulate fresh)
            // This removes duplicates and stale data - fresh sync is cleaner
            const itemsResult = await db.query(`
                DELETE FROM media_server_items RETURNING id
            `);

            // 6. Restart worker if it was running
            if (wasRunning) {
                this.startWorker();
            }

            // 7. Trigger library sync to repopulate library_id on items
            // This runs in background so we don't block the response
            const mediaSyncService = require('./mediaSync');
            const schedulerService = require('./scheduler');

            (async () => {
                try {
                    // First, sync libraries from media server to reassociate items with library_id
                    const librariesResult = await db.query(
                        'SELECT id FROM libraries WHERE is_active = true'
                    );

                    for (const lib of librariesResult.rows) {
                        await mediaSyncService.syncLibrary(lib.id);
                    }
                    logger.info('Library sync completed after clear');

                    // Then run gap analysis with fresh library_id associations
                    await schedulerService.runGapAnalysis();
                } catch (err) {
                    logger.error('Failed to run library sync after clear', { error: err.message });
                }
            })();

            const result = {
                queueCleared: queueResult.rowCount,
                historyCleared: historyResult.rowCount,
                patternsCleared: patternsResult.rowCount,
                correctionsCleared: correctionsResult.rowCount,
                rulesCleared: rulesV2Result.rowCount,
                itemsReset: itemsResult.rowCount
            };

            logger.info('Cleared queue and triggered resync', result);
            return result;
        } catch (error) {
            logger.error('Failed to clear and resync', { error: error.message });
            throw error;
        }
    }
}

// Singleton instance
const queueService = new QueueService();

module.exports = queueService;
