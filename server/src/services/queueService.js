/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * ============================================================================
 * DEPENDENCY INJECTION PATTERN
 * ============================================================================
 * 
 * This service uses dependency injection (DI) for testability and isolation.
 * 
 * WHY: Previously, this was a singleton with module-level requires. This caused
 * test pollution where mocked dependencies would bleed between test files,
 * resulting in flaky tests (~50% failure rate in enrichmentPipeline.test.js).
 * 
 * HOW IT WORKS:
 * - Default dependencies are loaded at module level (for production use)
 * - Constructor accepts an optional `deps` object to override any dependency
 * - The singleton export uses all defaults (backward compatible)
 * - Tests can import `QueueService` class and inject mocked dependencies
 * 
 * USAGE IN TESTS:
 *   const { QueueService } = require('../services/queueService');
 *   const mockDb = { query: jest.fn() };
 *   const queueService = new QueueService({ db: mockDb, tmdbService: mockTmdb });
 * 
 * USAGE IN PRODUCTION (unchanged):
 *   const queueService = require('./queueService'); // Uses default singleton
 * 
 * ============================================================================
 */

// Default dependencies - loaded at module level for DI support
const defaultDb = require('../config/database');
const { DB_ADVISORY_LOCKS } = require('../config/database');
const { createLogger } = require('../utils/logger');
const defaultClassificationService = require('./classification');
const defaultOllamaService = require('./ollama');
const defaultAiRouterService = require('./aiRouter');
const defaultSyncStatus = require('./syncStatus');
const defaultTmdbService = require('./tmdb');
const defaultOmdbService = require('./omdb');
const defaultEnrichmentRetryService = require('./enrichmentRetryService');
const { QueueReadModel } = require('./queueReadModel');
const { QueueMutationService } = require('./queueMutationService');
const { QueueAdminService } = require('./queueAdminService');
const { QueueCarsaService } = require('./queueCarsaService');
const { QueueWorkerLoopService } = require('./queueWorkerLoopService');
const { QueueTaskProcessorService } = require('./queueTaskProcessorService');
const { QueueRefillService } = require('./queueRefillService');
const {
    ENRICHMENT_METADATA_KEYS,
    TAVILY_METADATA_KEYS,
    buildJsonbPresenceOr
} = require('../utils/metadataEnrichment');
// Configuration
const POLL_INTERVAL_MS = 1000;  // Check queue every 1 second when idle
const MAX_CONCURRENT = 5;       // Process up to 5 tasks concurrently
const RETRY_DELAYS = [30, 60, 120, 300, 600]; // Seconds: 30s, 1m, 2m, 5m, 10m
const OMDB_CIRCUIT_WARN_THROTTLE_MS = 60000;
const DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS = 10000;

function parseEnvMs(envValue, defaultValue) {
    const parsed = Number.parseInt(envValue || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

const OMDB_SSL_WARN_THROTTLE_MS = parseEnvMs(process.env.OMDB_SSL_WARN_THROTTLE_MS, 15 * 60 * 1000);
const OMDB_SSL_BLOCK_MS = parseEnvMs(process.env.OMDB_SSL_BLOCK_MS, 15 * 60 * 1000);
const OMDB_SSL_RECOVERY_PROBE_MS = parseEnvMs(process.env.OMDB_SSL_RECOVERY_PROBE_MS, 60 * 1000);

// Visibility timeout: how long a worker holds exclusive ownership of a task before
// another worker (or the periodic recovery job) may re-claim it. Must exceed the
// longest expected task duration. Configurable for environments with slow AI models.
const VISIBILITY_TIMEOUT_MINUTES = parseInt(process.env.TASK_VISIBILITY_TIMEOUT_MINUTES || '10', 10);

// How often the worker loop checks for tasks whose visibility window has expired
// (as a safety net for crash recovery between restarts).
const VISIBILITY_RECOVERY_INTERVAL_MS = 60_000;

class QueueService {
    /**
     * Create a new QueueService instance
     * @param {Object} deps - Optional dependencies for testing
     * @param {Object} deps.db - Database service
     * @param {Object} deps.classificationService - Classification service
     * @param {Object} deps.ollamaService - Ollama AI service
     * @param {Object} deps.aiRouterService - AI Router service
     * @param {Object} deps.syncStatus - Sync status service
     * @param {Object} deps.tmdbService - TMDB API service
     * @param {Object} deps.omdbService - OMDb API service
     * @param {Object} deps.logger - Logger instance
     */
    constructor(deps = {}) {
        // Inject dependencies with defaults for production use
        this.db = deps.db || defaultDb;
        this.classificationService = deps.classificationService || defaultClassificationService;
        this.ollamaService = deps.ollamaService || defaultOllamaService;
        this.aiRouterService = deps.aiRouterService || defaultAiRouterService;
        this.syncStatus = deps.syncStatus || defaultSyncStatus;
        this.tmdbService = deps.tmdbService || defaultTmdbService;
        this.omdbService = deps.omdbService || defaultOmdbService;
        this.enrichmentRetryService = deps.enrichmentRetryService || defaultEnrichmentRetryService;
        this.logger = deps.logger || createLogger('QueueService');

        // Instance state
        this.running = false;
        this.processing = 0;
        this.aiAvailable = true;
        this.omdbLimitHit = false; // Track if OMDb limit hit to prevent log spam
        this.lastOmdbCircuitWarnAt = 0;
        this.lastOmdbSslWarnAt = 0;
        this.omdbSslBlockedUntil = 0;
        this.lastOmdbSslProbeAt = 0;
        // Tracks when visibility-timeout recovery last ran in the worker loop
        this.lastRecoveryCheck = 0;
        // Tracks when the worker first reached MAX_CONCURRENT (for stall detection)
        this.fullConcurrencyStartedAt = 0;

        this.queueReadModel = deps.queueReadModel || new QueueReadModel({
            db: this.db,
            logger: this.logger,
            getDispatchBlockers: () => this.hasClassificationDispatchBlocker(),
            getRuntimeState: () => ({
                aiAvailable: this.aiAvailable,
                workerRunning: this.running,
            }),
        });
        this.queueMutationService = deps.queueMutationService || new QueueMutationService({
            db: this.db,
            logger: this.logger,
            enqueueTask: (...args) => this.enqueue(...args),
        });
        this.queueAdminService = deps.queueAdminService || new QueueAdminService({
            db: this.db,
            logger: this.logger,
            classificationService: this.classificationService,
        });
        this.queueCarsaService = deps.queueCarsaService || new QueueCarsaService({
            db: this.db,
            logger: this.logger,
            syncStatus: this.syncStatus,
            getWorkerState: () => ({
                running: this.running,
                processing: this.processing,
            }),
            startWorker: (...args) => this.startWorker(...args),
            stopWorker: (...args) => this.stopWorker(...args),
            captureLibrarySnapshot: (...args) => this.buildLibrarySnapshot(...args),
            buildLibraryLookup: (...args) => this.buildNewLibraryLookup(...args),
            remapMappings: (...args) => this.remapAllArrMappings(...args),
            notifyRemapFailures: (...args) => this.createRemapFailureNotification(...args),
            performCleanup: (...args) => this.performClearAndResyncCleanup(...args),
            resetVolatileState: () => {
                this.omdbLimitHit = false;
                this.lastOmdbCircuitWarnAt = 0;
                this.lastOmdbSslWarnAt = 0;
                this.omdbSslBlockedUntil = 0;
                this.lastOmdbSslProbeAt = 0;
            },
        });
        this.queueWorkerLoopService = deps.queueWorkerLoopService || new QueueWorkerLoopService({
            db: this.db,
            logger: this.logger,
            getState: () => ({
                running: this.running,
                processing: this.processing,
                lastRecoveryCheck: this.lastRecoveryCheck,
                fullConcurrencyStartedAt: this.fullConcurrencyStartedAt,
            }),
            setRunning: (running) => {
                this.running = running;
            },
            incrementProcessing: () => {
                this.processing += 1;
            },
            decrementProcessing: () => {
                this.processing -= 1;
            },
            setLastRecoveryCheck: (value) => {
                this.lastRecoveryCheck = value;
            },
            setFullConcurrencyStartedAt: (value) => {
                this.fullConcurrencyStartedAt = value;
            },
            resetStaleProcessingTasks: (...args) => this.resetStaleProcessingTasks(...args),
            backgroundDrainIfBloated: (...args) => this._backgroundDrainIfBloated(...args),
            hasClassificationDispatchBlocker: (...args) => this.hasClassificationDispatchBlocker(...args),
            dequeue: (...args) => this.dequeue(...args),
            checkAIAvailability: (...args) => this.checkAIAvailability(...args),
            processTask: (...args) => this.processTask(...args),
            recoverExpiredVisibilityTasks: (...args) => this.recoverExpiredVisibilityTasks(...args),
            pollIntervalMs: POLL_INTERVAL_MS,
            maxConcurrent: MAX_CONCURRENT,
            visibilityRecoveryIntervalMs: VISIBILITY_RECOVERY_INTERVAL_MS,
        });
        this.queueTaskProcessorService = deps.queueTaskProcessorService || new QueueTaskProcessorService({
            db: this.db,
            logger: this.logger,
            classificationService: this.classificationService,
            omdbService: this.omdbService,
            tmdbService: this.tmdbService,
            completeTask: (...args) => this.completeTask(...args),
            failTask: (...args) => this.failTask(...args),
            queryWithTimeout: (...args) => this._queryWithTimeout(...args),
            isOmdbSslBlocked: (...args) => this.isOmdbSslBlocked(...args),
            getOmdbRuntimeState: () => ({
                omdbLimitHit: this.omdbLimitHit,
                lastOmdbCircuitWarnAt: this.lastOmdbCircuitWarnAt,
                lastOmdbSslWarnAt: this.lastOmdbSslWarnAt,
                omdbSslBlockedUntil: this.omdbSslBlockedUntil,
            }),
            setOmdbRuntimeState: (patch) => {
                if (Object.prototype.hasOwnProperty.call(patch, 'omdbLimitHit')) {
                    this.omdbLimitHit = patch.omdbLimitHit;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'lastOmdbCircuitWarnAt')) {
                    this.lastOmdbCircuitWarnAt = patch.lastOmdbCircuitWarnAt;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'lastOmdbSslWarnAt')) {
                    this.lastOmdbSslWarnAt = patch.lastOmdbSslWarnAt;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'omdbSslBlockedUntil')) {
                    this.omdbSslBlockedUntil = patch.omdbSslBlockedUntil;
                }
            },
            omdbCircuitWarnThrottleMs: OMDB_CIRCUIT_WARN_THROTTLE_MS,
            omdbSslWarnThrottleMs: OMDB_SSL_WARN_THROTTLE_MS,
            omdbSslBlockMs: OMDB_SSL_BLOCK_MS,
        });
        this.queueRefillService = deps.queueRefillService || new QueueRefillService({
            db: this.db,
            logger: this.logger,
        });
    }

    async isOmdbSslBlocked(omdbApiKey, title) {
        const now = Date.now();

        if (this.omdbSslBlockedUntil === 0 || now >= this.omdbSslBlockedUntil) {
            return false;
        }

        if ((now - this.lastOmdbSslProbeAt) < OMDB_SSL_RECOVERY_PROBE_MS) {
            return true;
        }

        this.lastOmdbSslProbeAt = now;

        try {
            const health = await this.omdbService.checkHealth(omdbApiKey);
            if (health?.healthy) {
                this.omdbSslBlockedUntil = 0;
                this.lastOmdbSslWarnAt = 0;
                this.logger.info('OMDb SSL recovery detected; resuming OMDb enrichment', { title });
                return false;
            }

            if (health?.ssl_error) {
                this.omdbSslBlockedUntil = now + OMDB_SSL_BLOCK_MS;
                if ((now - this.lastOmdbSslWarnAt) >= OMDB_SSL_WARN_THROTTLE_MS) {
                    this.lastOmdbSslWarnAt = now;
                    this.logger.warn('OMDb SSL certificate issue persists; OMDb enrichment remains temporarily paused', {
                        title,
                        message: health.message
                    });
                } else {
                    this.logger.debug('OMDb SSL persistent warning suppressed', { title });
                }
                return true;
            }
        } catch (healthError) {
            this.logger.debug('OMDb SSL recovery probe failed', {
                title,
                error: healthError.message
            });
        }

        return true;
    }

    /**
     * Add a task to the queue
     */
    async enqueue(taskType, payload, options = {}) {
        const { priority = 0, webhookLogId = null, source = 'webhook', maxAttempts = 5 } = options;

        try {
            const result = await this.db.query(
                `INSERT INTO task_queue (task_type, payload, priority, webhook_log_id, source, max_attempts)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
                [taskType, JSON.stringify(payload), priority, webhookLogId, source, maxAttempts]
            );

            const taskId = result.rows[0].id;
            this.logger.info('Task enqueued', { taskId, taskType, source });
            return taskId;
        } catch (error) {
            this.logger.error('Failed to enqueue task', { error: error.message, taskType });
            throw error;
        }
    }

    async hasClassificationDispatchBlocker() {
        try {
            const result = await this.db.query(
                `SELECT
                    EXISTS (
                        SELECT 1
                        FROM task_queue
                        WHERE task_type = 'classification'
                          AND status = 'processing'
                    ) AS has_processing_classification`,
                []
            );

            const row = result.rows[0] || {};

            return {
                hasProcessingClassification: row.has_processing_classification === true,
                lookupFailed: false,
            };
        } catch (error) {
            this.logger.error('Failed to check classification dispatch blockers', { error: error.message });
            return {
                hasProcessingClassification: false,
                lookupFailed: true,
            };
        }
    }

    /**
     * Get the next pending task
     */
    async dequeue(options = {}) {
        const { excludeClassification = false } = options;
        const classificationFilter = excludeClassification ? "AND task_type <> 'classification'" : '';

        try {
            const result = await this.db.query(
                // Picks up either:
                //   (a) a pending task whose retry window has elapsed, OR
                //   (b) a processing task whose visibility window has expired
                //       (crash/OOM recovery — the worker that held this task is gone).
                // Sets visible_at to NOW() + VISIBILITY_TIMEOUT_MINUTES so that if
                // THIS worker also crashes, another worker can recover it after the window.
                `UPDATE task_queue
         SET status = 'processing', started_at = NOW(),
             visible_at = NOW() + INTERVAL '${VISIBILITY_TIMEOUT_MINUTES} minutes'
         WHERE id = (
           SELECT id FROM task_queue
           WHERE (
                 (status = 'pending' AND next_retry_at <= NOW())
              OR (status = 'processing'
                  AND visible_at IS NOT NULL
                  AND visible_at <= NOW())
           )
             ${classificationFilter}
           ORDER BY priority DESC, created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`
            );

            return result.rows[0] || null;
        } catch (error) {
            this.logger.error('Failed to dequeue task', { error: error.message });
            return null;
        }
    }

    /**
     * Mark task as completed
     */
    async completeTask(taskId, result = {}) {
        try {
            await this.db.query(
                `UPDATE task_queue
         SET status = 'completed', completed_at = NOW(), visible_at = NULL, payload = payload || $2
         WHERE id = $1`,
                [taskId, JSON.stringify({ result })]
            );
            this.logger.info('Task completed', { taskId });
        } catch (error) {
            this.logger.error('Failed to complete task', { error: error.message, taskId });
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
                await this.db.query(
                    `UPDATE task_queue
           SET status = 'failed', error_message = $2, attempts = $3, completed_at = NOW()
           WHERE id = $1`,
                    [taskId, errorMessage, nextAttempt]
                );
                this.logger.error('Task permanently failed', { taskId, attempts: nextAttempt });
            } else {
                // Schedule retry with exponential backoff
                const delaySeconds = RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)];
                await this.db.query(
                    `UPDATE task_queue
           SET status = 'pending', error_message = $2, attempts = $3,
               next_retry_at = NOW() + INTERVAL '${delaySeconds} seconds',
               started_at = NULL, visible_at = NULL
           WHERE id = $1`,
                    [taskId, errorMessage, nextAttempt]
                );
                this.logger.warn('Task scheduled for retry', { taskId, attempt: nextAttempt, delaySeconds });
            }
        } catch (error) {
            this.logger.error('Failed to update task status', { error: error.message, taskId });
        }
    }



    /**
     * Check if AI is available (respects configured provider)
     */
    async checkAIAvailability() {
        try {
            // Get the configured AI provider
            const provider = await this.aiRouterService.getProvider('classification');

            // No provider configured or AI disabled
            if (!provider) {
                if (this.aiAvailable) {
                    this.logger.info('AI is disabled or no provider configured');
                }
                this.aiAvailable = false;
                return false;
            }

            // Cloud provider (OpenAI, Gemini, etc.) - assume available if configured
            if (provider.isCloud) {
                if (!this.aiAvailable) {
                    this.logger.info(`Cloud AI provider available: ${provider.type}`);
                }
                this.aiAvailable = true;
                return true;
            }

            // Ollama provider - need to check connection
            if (provider.type === 'ollama') {
                const result = await this.ollamaService.testConnection();

                if (result.success) {
                    if (!this.aiAvailable) {
                        this.logger.info('Ollama is now available');
                    }
                    this.aiAvailable = true;
                    return true;
                } else {
                    if (this.aiAvailable) {
                        this.logger.warn('Ollama is offline', { error: result.error });
                    }
                    this.aiAvailable = false;
                    return false;
                }
            }

            // Unknown provider type
            this.logger.warn('Unknown AI provider type', { type: provider.type });
            return false;
        } catch (error) {
            if (this.aiAvailable) {
                this.logger.warn('AI availability check failed', { error: error.message });
            }
            this.aiAvailable = false;
            return false;
        }
    }

    /**
     * Process rating normalization for a media item
     */
    async processRatingNormalization(task) {
        return this.queueTaskProcessorService.processRatingNormalization(task);
    }

    /**
     * Process a single task
     */
    async processTask(task) {
        return this.queueTaskProcessorService.processTask(task);
    }

    /**
     * Reset any tasks stuck in 'processing' state from previous runs.
     * Uses a transaction-level advisory lock to prevent two containers from
     * racing during a rolling restart (K8s maxSurge > 0). If another container
     * already holds the lock it is already doing the reset — skip silently.
     */
    async resetStaleProcessingTasks() {
        let client;
        try {
            client = await this.db.pool.connect();
            await client.query('BEGIN');
            const lockResult = await client.query(
                'SELECT pg_try_advisory_xact_lock($1) AS acquired',
                [DB_ADVISORY_LOCKS.STARTUP_RESET]
            );
            if (!lockResult.rows[0].acquired) {
                this.logger.info('resetStaleProcessingTasks: skipped (another container holds startup lock)');
                await client.query('ROLLBACK');
                return 0;
            }
            const result = await client.query(
                // Age guard: only reset tasks that have been processing for more than
                // VISIBILITY_TIMEOUT_MINUTES. Tasks started very recently (e.g. during
                // a rolling restart overlap) are left alone and will self-recover via
                // the visibility timeout in the worker loop.
                `UPDATE task_queue 
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = 'Reset on startup - previous worker crashed'
                 WHERE status = 'processing'
                   AND (started_at IS NULL OR started_at < NOW() - INTERVAL '${VISIBILITY_TIMEOUT_MINUTES} minutes')
                 RETURNING id`
            );
            await client.query('COMMIT');
            if (result.rowCount > 0) {
                this.logger.warn('Reset stale processing tasks on startup', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id)
                });
            }
            return result.rowCount;
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            this.logger.error('Failed to reset stale tasks', { error: error.message });
            return 0;
        } finally {
            if (client) client.release();
        }
    }

    /**
     * Main worker loop
     */
    async startWorker() {
        return this.queueWorkerLoopService.startWorker();
    }

    /**
     * Stop the worker
     */
    stopWorker() {
        this.running = false;
        this.logger.info('Queue worker stopping...');
    }

    /**
     * Graceful shutdown: stop the worker loop and reset any in-flight tasks back
     * to 'pending' so they are retried on next startup without a stale-task WARN.
     */
    /**
     * Periodic recovery: re-queue any tasks whose visibility window has expired.
     * Called from the worker loop every VISIBILITY_RECOVERY_INTERVAL_MS.
     * Provides crash/OOM recovery without requiring a process restart.
     *
     * @returns {Promise<number>} number of tasks recovered
     */
    async recoverExpiredVisibilityTasks() {
        try {
            const result = await this.db.query(
                `UPDATE task_queue
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = 'Recovered: visibility timeout expired'
                 WHERE status = 'processing'
                   AND visible_at IS NOT NULL
                   AND visible_at <= NOW()
                 RETURNING id`
            );
            if (result.rowCount > 0) {
                // Compensate the in-memory counter so dequeue() can resume immediately.
                // Without this, this.processing stays at MAX_CONCURRENT even though the
                // DB rows have been reset to 'pending', and no new tasks are ever dequeued.
                this.processing = Math.max(0, this.processing - result.rowCount);
                this.logger.warn('Recovered tasks with expired visibility timeout; decremented processing counter', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id),
                    processingAfter: this.processing,
                });
            }
            return result.rowCount;
        } catch (error) {
            this.logger.error('Failed to recover expired visibility tasks', { error: error.message });
            return 0;
        }
    }

    async gracefulShutdown() {
        this.stopWorker();
        try {
            const result = await this.db.query(
                `UPDATE task_queue
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = 'Reset by graceful shutdown'
                 WHERE status = 'processing'
                 RETURNING id`
            );
            if (result.rowCount > 0) {
                this.logger.info('Graceful shutdown: reset in-flight tasks to pending', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id),
                });
            }
        } catch (err) {
            this.logger.error('Graceful shutdown: failed to reset in-flight tasks', { error: err.message });
        }
    }

    /**
     * Get queue statistics
     */
    async getStats() {
        return this.queueReadModel.getStats();
    }

    /**
     * Get gap analysis statistics for progress indicator
     */
    async getGapAnalysisStats() {
        return this.queueReadModel.getGapAnalysisStats();
    }

    async getLiveStats() {
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
        try {
            retryQueueStats = await this.getEnrichmentRetryStats();
        } catch (_error) {
            // Retry queue table may not exist yet
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

    /**
     * Get pending tasks
     */
    async getPendingTasks(limit = 20) {
        return this.queueReadModel.getPendingTasks(limit);
    }

    /**
     * Get failed tasks
     */
    async getFailedTasks(limit = 20) {
        return this.queueReadModel.getFailedTasks(limit);
    }

    async getEnrichmentRetryStats() {
        return this.enrichmentRetryService.getStats();
    }

    getOllamaStatus() {
        return this.ollamaService.getGenerationStatus();
    }

    async processEnrichmentRetryQueue(limit = 50, enrichmentType = 'tavily') {
        return this.enrichmentRetryService.processRetryQueue(limit, enrichmentType);
    }

    async backfillEnrichmentRetryQueue() {
        return this.enrichmentRetryService.backfillRetryQueue();
    }

    /**
     * Retry a failed task
     */
    async retryTask(taskId) {
        return this.queueMutationService.retryTask(taskId);
    }

    /**
     * Dismiss a failed task
     */
    async dismissFailedTask(taskId) {
        return this.queueMutationService.dismissFailedTask(taskId);
    }

    /**
     * Cancel a pending task
     */
    async cancelTask(taskId) {
        return this.queueMutationService.cancelTask(taskId);
    }

    /**
     * Manually classify a pending queue task
     */
    async manualClassifyTask(taskId, libraryId, resolvedBy = 'admin') {
        return this.queueAdminService.manualClassifyTask(taskId, libraryId, resolvedBy);
    }

    /**
     * Clear all completed tasks
     */
    async clearCompletedTasks() {
        return this.queueMutationService.clearCompletedTasks();
    }

    /**
     * Clear all failed tasks
     */
    async clearFailedTasks() {
        return this.queueMutationService.clearFailedTasks();
    }

    /**
     * Retry all failed tasks
     */
    async retryAllFailedTasks() {
        return this.queueMutationService.retryAllFailedTasks();
    }

    /**
     * Cancel all pending tasks
     */
    async cancelAllPendingTasks() {
        return this.queueMutationService.cancelAllPendingTasks();
    }

    /**
     * Re-queue all completed classifications for reprocessing with updated rules
     */
    async reprocessCompleted() {
        return this.queueMutationService.reprocessCompleted();
    }

    /**
     * Build library snapshot with external IDs AND mappings before clearing
     * Captures library info and mapping info needed to restore after re-sync
     */
    async buildLibrarySnapshot() {
        return this.queueCarsaService.buildLibrarySnapshot();
    }

    /**
     * Build new library lookup after re-sync
     * Creates lookup tables by external ID, name+type for matching
     */
    async buildNewLibraryLookup() {
        return this.queueCarsaService.buildNewLibraryLookup();
    }

    /**
     * Find new library ID using priority matching
     * Priority: external_id (most reliable) > name+type (fallback)
     */
    findNewLibraryId(oldLibInfo, newLookup) {
        return this.queueCarsaService.findNewLibraryId(oldLibInfo, newLookup);
    }

    /**
     * Remap mappings for a single *arr instance
     * Recreates mappings that were CASCADE deleted when libraries were cleared
     */
    async remapInstanceMappings(type, config, snapshot, newLookup) {
        return this.queueCarsaService.remapInstanceMappings(type, config, snapshot, newLookup);
    }

    /**
     * Remap library mappings for ALL Radarr and Sonarr instances
     */
    async remapAllArrMappings(oldLibrarySnapshot, newLibraryLookup) {
        return this.queueCarsaService.remapAllArrMappings(oldLibrarySnapshot, newLibraryLookup);
    }

    /**
     * Notify user about mappings that couldn't be restored
     */
    async createRemapFailureNotification(results) {
        return this.queueCarsaService.createRemapFailureNotification(results);
    }

    /**
     * Execute `work(client)` inside a transaction if a real pool is available;
     * falls back to calling `work(db)` directly when `this.db` is a bare query
     * object (e.g. in unit tests). Commits on success, rolls back on error,
     * always releases the client in a finally block.
     *
     * @param {function} work - async fn receiving a pg PoolClient or db object
     * @param {string} [context='transaction'] - label used in rollback warning logs
     * @returns {Promise<*>} result of work
     */
    /**
     * Run a single write query with a per-statement timeout on a dedicated pool client.
     * Prevents a blocked UPDATE (e.g. due to a concurrent Plex sync row lock) from
     * occupying a worker slot indefinitely.  Falls back to the regular db.query() when
     * db.pool is unavailable (test environments that only mock db.query).
     *
     * @param {string} sql    Parameterised SQL string
     * @param {Array}  params Bind parameters
     * @param {number} [timeoutMs=30000]  Statement timeout in milliseconds
     */
    async _queryWithTimeout(sql, params, timeoutMs = 30_000) {
        let client;
        try {
            if (this.db.pool && typeof this.db.pool.connect === 'function') {
                client = await this.db.pool.connect();
            }
        } catch (_) {
            // Pool unavailable — fall through to regular query
        }

        // If we didn't get a real client (e.g. test auto-mock returns undefined),
        // fall back to the standard db.query so tests don't need db.pool set up.
        if (!client || typeof client.query !== 'function') {
            return this.db.query(sql, params);
        }

        try {
            await client.query('BEGIN');
            await client.query(`SET LOCAL statement_timeout = '${timeoutMs}'`); // sql-interpolation: SET LOCAL param cannot use $N placeholders; timeoutMs is a validated positive integer
            const result = await client.query(sql, params);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    async withOptionalTransaction(work, context = 'transaction') {
        return this.queueCarsaService.withOptionalTransaction(work, context);
    }

    isForeignKeyConstraintError(error) {
        return this.queueCarsaService.isForeignKeyConstraintError(error);
    }

    normalizeClearAndResyncError(error) {
        return this.queueCarsaService.normalizeClearAndResyncError(error);
    }

    async performClearAndResyncCleanup() {
        return this.queueCarsaService.performClearAndResyncCleanup();
    }

    async clearAndResync() {
        return this.queueCarsaService.clearAndResync();
    }
    /**
     * Finds items that need analysis and adds them to the queue
     * This is used by the scheduler (gap analysis) and manual ingestion triggers
     */
    /**
     * Drain old completed/failed/cancelled task_queue rows in the background.
     * Called once at worker startup. Loops in batches of 5 000 until no more
     * rows older than TASK_QUEUE_RETENTION_DAYS remain, then applies a
     * count-based cap so high-volume instances don't accumulate hundreds of
     * thousands of recent completed rows within the retention window.
     *
     * Two triggers (either may fire independently):
     *   1. Age-based  — rows older than TASK_QUEUE_RETENTION_DAYS
     *   2. Count-based — total completed/failed/cancelled rows > MAX_TOTAL_ROWS
     *      → keeps only the MAX_TOTAL_ROWS most-recent rows (deletes the oldest)
     *
     * The count check fires when the stale row count exceeds BLOAT_THRESHOLD
     * (1 000) to avoid unnecessary DB round-trips on healthy instances.
     */
    async _backgroundDrainIfBloated() {
        const BLOAT_THRESHOLD = 1000;
        // Hard cap on total completed/failed/cancelled rows regardless of age.
        // Prevents slow INSERT/index-maintenance on high-throughput instances
        // where every row is still within the retention window.
        const MAX_TOTAL_ROWS = parseInt(process.env.TASK_QUEUE_MAX_TOTAL_ROWS, 10) || DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS;
        const BATCH = 5000;

        const parsed = parseInt(process.env.TASK_QUEUE_RETENTION_DAYS, 10);
        const retentionDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;

        // Single query gets both the age-based stale count and the total count.
        const countResult = await this.db.query(
            `SELECT
               COUNT(*) FILTER (WHERE created_at < NOW() - ($1 || ' days')::INTERVAL) AS stale_count,
               COUNT(*) AS total_count
             FROM task_queue
             WHERE status IN ('completed', 'failed', 'cancelled')`,
            [retentionDays]
        );
        const staleCount = parseInt(countResult.rows[0].stale_count) || 0;
        const totalCount = parseInt(countResult.rows[0].total_count) || 0;

        const ageBloated = staleCount > BLOAT_THRESHOLD;
        const countBloated = totalCount > MAX_TOTAL_ROWS;

        if (!ageBloated && !countBloated) return;

        this.logger.warn('task_queue bloat detected at startup; running background drain', {
            staleRows: staleCount,
            totalRows: totalCount,
            retentionDays,
            maxTotalRows: MAX_TOTAL_ROWS,
            trigger: ageBloated && countBloated ? 'age+count' : ageBloated ? 'age' : 'count'
        });

        let totalDeleted = 0;
        let batchDeleted;

        // --- Age-based drain (existing behaviour) ---
        if (ageBloated) {
            do {
                const result = await this.db.query(
                    `DELETE FROM task_queue
                     WHERE id IN (
                         SELECT id FROM task_queue
                         WHERE status IN ('completed', 'failed', 'cancelled')
                           AND created_at < NOW() - ($1 || ' days')::INTERVAL
                         LIMIT $2
                     )`,
                    [retentionDays, BATCH]
                );
                batchDeleted = result.rowCount;
                totalDeleted += batchDeleted;
                // Yield between batches so the drain doesn't starve the event loop
                await new Promise(resolve => setTimeout(resolve, 50));
            } while (batchDeleted === BATCH);
        }

        // --- Count-based drain (new) ---
        // After the age drain, re-check or use the original total; if still over
        // the cap, delete the oldest completed/failed/cancelled rows until only
        // MAX_TOTAL_ROWS remain.
        const remainingAfterAge = totalCount - totalDeleted;
        if (countBloated && remainingAfterAge > MAX_TOTAL_ROWS) {
            const excess = remainingAfterAge - MAX_TOTAL_ROWS;
            this.logger.warn('task_queue count cap exceeded; trimming oldest rows', {
                remaining: remainingAfterAge,
                maxTotalRows: MAX_TOTAL_ROWS,
                toDelete: excess
            });
            let countDeleted = 0;
            do {
                const batchSize = Math.min(BATCH, excess - countDeleted);
                if (batchSize <= 0) break;
                const result = await this.db.query(
                    `DELETE FROM task_queue
                     WHERE id IN (
                         SELECT id FROM task_queue
                         WHERE status IN ('completed', 'failed', 'cancelled')
                         ORDER BY created_at ASC
                         LIMIT $1
                     )`,
                    [batchSize]
                );
                batchDeleted = result.rowCount;
                countDeleted += batchDeleted;
                totalDeleted += batchDeleted;
                await new Promise(resolve => setTimeout(resolve, 50));
            } while (batchDeleted > 0 && countDeleted < excess);
        }

        this.logger.info('Background task_queue drain complete', { deleted: totalDeleted, retentionDays });

        // Refresh query planner statistics after bulk delete so subsequent queries don't
        // plan against a stale row-count estimate.  VACUUM ANALYZE runs outside any
        // transaction (pool autocommit), so it is safe to call here.
        try {
            await this.db.query('VACUUM ANALYZE task_queue');
            this.logger.info('task_queue VACUUM ANALYZE complete after background drain');
        } catch (vacuumErr) {
            this.logger.warn('task_queue VACUUM ANALYZE failed after background drain (non-fatal)', {
                error: vacuumErr.message
            });
        }
    }

    async refillQueue() {
        try {
            const candidates = await this.queueRefillService.selectRefillCandidates();

            if (candidates.length === 0) {
                this.logger.debug('Refill queue: No unanalyzed items found');
                return { queued: 0 };
            }

            this.logger.info(`Refill queue: Found ${candidates.length} unanalyzed items. Queueing for metadata enrichment...`);
            let queuedCount = 0;

            for (const item of candidates) {
                await this.enqueue('metadata_enrichment', this.queueRefillService.buildMetadataEnrichmentPayload(item), {
                    priority: 5, // Lower priority than user actions
                    source: 'gap_analysis'
                });
                queuedCount++;
            }

            return { queued: queuedCount };
        } catch (error) {
            this.logger.error('Error refilling queue', { error: error.message });
            throw error;
        }
    }
}

// Default singleton instance for production use
const queueService = new QueueService();

// Export singleton for backward compatibility
module.exports = queueService;

// Export class for dependency injection in tests
module.exports.QueueService = QueueService;

