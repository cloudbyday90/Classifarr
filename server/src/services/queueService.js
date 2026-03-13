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

// Configuration
const POLL_INTERVAL_MS = 1000;  // Check queue every 1 second when idle
const MAX_CONCURRENT = 5;       // Process up to 5 tasks concurrently
const RETRY_DELAYS = [30, 60, 120, 300, 600]; // Seconds: 30s, 1m, 2m, 5m, 10m
const OMDB_CIRCUIT_WARN_THROTTLE_MS = 60000;

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

    /**
     * Get the next pending task
     */
    async dequeue() {
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
           WHERE (status = 'pending' AND next_retry_at <= NOW())
              OR (status = 'processing'
                  AND visible_at IS NOT NULL
                  AND visible_at <= NOW())
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
        const ratingNormalizer = require('../utils/ratingNormalizer');
        const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
        const { media_item_id } = payload;

        let skipped = false;
        let originalRating, normalizedRating;

        // Use a dedicated connection so SET LOCAL statement_timeout is scoped to this
        // transaction only and does not bleed into other queries sharing the pool.
        const client = await this.db.pool.connect();
        try {
            await client.query('BEGIN');
            // Cap the UPDATE at 30 s so a concurrent Plex-sync row lock cannot hold this
            // worker slot indefinitely. On timeout the task is retried via failTask/backoff.
            await client.query("SET LOCAL statement_timeout = '30000'");

            const result = await client.query(`
                SELECT id, content_rating, metadata, media_type
                FROM media_server_items WHERE id = $1
            `, [media_item_id]);

            if (result.rows.length === 0) {
                skipped = true;
            } else {
                const item = result.rows[0];
                originalRating = item.content_rating;
                normalizedRating = ratingNormalizer.getPriorityRating(item);

                // Always set original_rating on first normalization, even if rating doesn't change.
                // This marks the item as processed and prevents re-queuing.
                await client.query(`
                    UPDATE media_server_items
                    SET original_rating = COALESCE(original_rating, $2), 
                        content_rating = $3, 
                        last_synced = NOW()
                    WHERE id = $1
                `, [media_item_id, originalRating, normalizedRating]);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            this.logger.error('Rating normalization failed', {
                itemId: media_item_id,
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }

        if (skipped) {
            await this.completeTask(task.id, { skipped: true, reason: 'Item not found' });
            return;
        }

        if (normalizedRating !== originalRating) {
            this.logger.info('Rating normalized', {
                itemId: media_item_id,
                original: originalRating,
                normalized: normalizedRating
            });

            await this.completeTask(task.id, {
                normalized: true,
                original: originalRating,
                new: normalizedRating
            });
        } else {
            this.logger.debug('Rating already standard', {
                itemId: media_item_id,
                rating: originalRating
            });

            await this.completeTask(task.id, {
                normalized: false,
                reason: 'Rating already standard',
                rating: originalRating
            });
        }
    }

    /**
     * Process a single task
     */
    async processTask(task) {
        this.logger.info('Processing task', { taskId: task.id, taskType: task.task_type });

        try {
            switch (task.task_type) {
                case 'classification':
                    const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
                    const result = await this.classificationService.classify({ ...payload, taskId: task.id });
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
                        await this._queryWithTimeout(
                            `UPDATE media_server_items 
                             SET metadata = metadata || $1::jsonb
                             WHERE id = $2`,
                            [JSON.stringify(newMetadata), payload.itemId]
                        );
                    }

                    // Update webhook_log if linked
                    if (task.webhook_log_id) {
                        await this.db.query(
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

                    // SELF-HEALING: If key fields are missing from payload (stale queue item),
                    // look them up from the database (which may have been updated by a sync)
                    let enrichTmdbId = enrichPayload.tmdbId || enrichPayload.tmdb_id;
                    let enrichSourceLibraryId = enrichPayload.source_library_id;
                    let enrichSourceLibraryName = enrichPayload.source_library_name;

                    if (enrichPayload.itemId && (!enrichTmdbId || !enrichSourceLibraryId)) {
                        try {
                            const itemResult = await this.db.query(
                                `SELECT msi.tmdb_id, msi.library_id, msi.metadata, l.name as library_name 
                                 FROM media_server_items msi 
                                 LEFT JOIN libraries l ON msi.library_id = l.id 
                                 WHERE msi.id = $1`,
                                [enrichPayload.itemId]
                            );
                            if (itemResult.rows.length > 0) {
                                const row = itemResult.rows[0];
                                if (!enrichTmdbId && row.tmdb_id) {
                                    enrichTmdbId = row.tmdb_id;
                                }
                                if (!enrichSourceLibraryId && row.library_id) {
                                    enrichSourceLibraryId = row.library_id;
                                }
                                if (!enrichSourceLibraryName && row.library_name) {
                                    enrichSourceLibraryName = row.library_name;
                                }
                                if (!enrichPayload.posterPath && row.metadata) {
                                    const itemMetadata = typeof row.metadata === 'string'
                                        ? JSON.parse(row.metadata)
                                        : row.metadata;
                                    if (itemMetadata?.posterPath) {
                                        enrichPayload.posterPath = itemMetadata.posterPath;
                                    }
                                    if (!enrichPayload.poster_path && itemMetadata?.poster_path) {
                                        enrichPayload.poster_path = itemMetadata.poster_path;
                                    }
                                }
                                this.logger.info('Self-heal: Retrieved missing metadata from database', {
                                    itemId: enrichPayload.itemId,
                                    tmdbId: enrichTmdbId,
                                    libraryId: enrichSourceLibraryId,
                                    libraryName: enrichSourceLibraryName
                                });
                            }
                        } catch (lookupError) {
                            this.logger.debug('Self-heal lookup failed', { error: lookupError.message });
                        }
                    }

                    // Build enrichment data - 100% confidence from source library
                    const enrichmentData = {
                        content_analysis: {
                            type: 'source_library',  // Already classified by library placement
                            confidence: 100,
                            detected_at: new Date().toISOString(),
                            source: 'metadata_enrichment',
                            source_library_id: enrichSourceLibraryId,
                            source_library_name: enrichSourceLibraryName
                        }
                    };

                    // ========== OMDb ENRICHMENT (PRIMARY) ==========
                    // OMDb provides structured data: content rating, genre, IMDB rating
                    // This is the PREFERRED source - runs first
                    // Skip if daily limit already hit (flag set from previous 401/limit error)
                    if (!this.omdbLimitHit) {
                        try {
                            const omdbConfig = await this.db.query('SELECT * FROM omdb_config WHERE is_active = true LIMIT 1');

                            if (omdbConfig.rows.length > 0 && omdbConfig.rows[0].api_key) {
                                // Using injected this.omdbService
                                const omdbApiKey = omdbConfig.rows[0].api_key;

                                // For TV shows, only query the main show, not episodes
                                const mediaType = enrichPayload.media?.media_type || 'movie';

                                this.logger.info('OMDb lookup', { title: enrichPayload.title, type: mediaType });

                                const sslBlocked = await this.isOmdbSslBlocked(omdbApiKey, enrichPayload.title);
                                if (sslBlocked) {
                                    if (enrichPayload.itemId) {
                                        try {
                                            const enrichmentRetryService = require('./enrichmentRetryService');
                                            await enrichmentRetryService.queueForRetry(
                                                enrichPayload.itemId,
                                                'omdb',
                                                'OMDb SSL certificate issue',
                                                6
                                            );
                                        } catch (retryErr) {
                                            this.logger.debug('Failed to queue for retry', { error: retryErr.message });
                                        }
                                    }
                                } else {
                                    const omdbResult = await this.omdbService.getByTitle(
                                        enrichPayload.title,
                                        enrichPayload.year,
                                        mediaType,
                                        omdbApiKey
                                    );

                                    if (omdbResult) {
                                        enrichmentData.omdb = {
                                            fetched_at: new Date().toISOString(),
                                            data: omdbResult
                                        };

                                        // Extract classification-relevant data for easier access
                                        enrichmentData.content_analysis = {
                                            ...enrichmentData.content_analysis,
                                            omdb_rated: omdbResult.rated,
                                            omdb_genre: omdbResult.genre,
                                            omdb_imdb_rating: omdbResult.imdbRating,
                                            is_animation: omdbResult.genre?.toLowerCase().includes('animation'),
                                            is_documentary: omdbResult.genre?.toLowerCase().includes('documentary'),
                                            is_family: omdbResult.genre?.toLowerCase().includes('family'),
                                            is_kids: ['G', 'TV-G', 'TV-Y', 'TV-Y7'].includes(omdbResult.rated),
                                            is_adult: ['R', 'NC-17', 'TV-MA'].includes(omdbResult.rated)
                                        };

                                        this.logger.info('OMDb enrichment successful', {
                                            title: enrichPayload.title,
                                            rated: omdbResult.rated,
                                            genre: omdbResult.genre
                                        });

                                        // Normalize rating from OMDb if available
                                        if (enrichPayload.itemId && omdbResult.rated && omdbResult.rated !== 'N/A') {
                                            try {
                                                const currentItem = await this.db.query(
                                                    `SELECT content_rating FROM media_server_items WHERE id = $1`,
                                                    [enrichPayload.itemId]
                                                );

                                                if (currentItem.rows.length > 0) {
                                                    const currentRating = currentItem.rows[0].content_rating;

                                                    await this._queryWithTimeout(
                                                        `UPDATE media_server_items
                                                         SET original_rating = COALESCE(original_rating, $2), content_rating = $3
                                                         WHERE id = $1`,
                                                        [enrichPayload.itemId, currentRating, omdbResult.rated]
                                                    );

                                                    this.logger.info('Rating updated from OMDb', {
                                                        itemId: enrichPayload.itemId,
                                                        original: currentRating,
                                                        omdb: omdbResult.rated
                                                    });
                                                }
                                            } catch (ratingError) {
                                                this.logger.debug('Failed to update rating from OMDb', { error: ratingError.message });
                                            }
                                        }
                                    } else if (enrichPayload.itemId) {
                                        // OMDb returned no result - queue for Tavily fallback
                                        try {
                                            const enrichmentRetryService = require('./enrichmentRetryService');
                                            await enrichmentRetryService.queueForRetry(
                                                enrichPayload.itemId,
                                                'tavily',
                                                'OMDb not found',
                                                5
                                            );
                                            this.logger.debug('Queued item for Tavily fallback', { title: enrichPayload.title });
                                        } catch (retryErr) {
                                            this.logger.debug('Failed to queue for retry', { error: retryErr.message });
                                        }
                                    }
                                }
                            }
                        } catch (omdbError) {
                            const isCircuitBlocked = omdbError.code === 'CIRCUIT_BREAKER_OPEN' ||
                                omdbError.code === 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED' ||
                                omdbError.code === 'CIRCUIT_BREAKER_REJECTED';
                            const omdbErrorMessage = (omdbError.message || '').toLowerCase();
                            const isSslCertificateError = Boolean(
                                omdbError.isOmdbSslCertError ||
                                omdbError.code === 'CERT_HAS_EXPIRED' ||
                                omdbError.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
                                omdbError.code === 'CERT_NOT_YET_VALID' ||
                                omdbErrorMessage.includes('certificate')
                            );

                            if (omdbError.name === 'OMDbLimitReachedError' ||
                                (omdbError.message && omdbError.message.includes('Limit Reached'))) {

                                // Only log once per session since limit won't reset until next day
                                if (!this.omdbLimitHit) {
                                    this.logger.warn('OMDb daily limit reached - skipping OMDb enrichment until API resets', { error: omdbError.message });
                                    this.omdbLimitHit = true;
                                }

                                // Queue for Tavily fallback when OMDb limit reached
                                if (enrichPayload.itemId) {
                                    try {
                                        const enrichmentRetryService = require('./enrichmentRetryService');
                                        await enrichmentRetryService.queueForRetry(
                                            enrichPayload.itemId,
                                            'tavily',
                                            'OMDb limit reached',
                                            3 // Higher priority since it's a quota issue
                                        );
                                    } catch (retryErr) {
                                        this.logger.debug('Failed to queue for retry', { error: retryErr.message });
                                    }
                                }
                            } else if (isSslCertificateError) {
                                const now = Date.now();
                                this.omdbSslBlockedUntil = now + OMDB_SSL_BLOCK_MS;
                                if ((now - this.lastOmdbSslWarnAt) >= OMDB_SSL_WARN_THROTTLE_MS) {
                                    this.lastOmdbSslWarnAt = now;
                                    this.logger.warn('OMDb SSL certificate issue; queuing OMDb retry and pausing OMDb enrichment until recovery probe succeeds', {
                                        title: enrichPayload.title,
                                        code: omdbError.code,
                                        error: omdbError.message
                                    });
                                } else {
                                    this.logger.debug('OMDb SSL certificate warning suppressed', {
                                        title: enrichPayload.title,
                                        code: omdbError.code
                                    });
                                }

                                if (enrichPayload.itemId) {
                                    try {
                                        const enrichmentRetryService = require('./enrichmentRetryService');
                                        await enrichmentRetryService.queueForRetry(
                                            enrichPayload.itemId,
                                            'omdb',
                                            'OMDb SSL certificate issue',
                                            6
                                        );
                                    } catch (retryErr) {
                                        this.logger.debug('Failed to queue for retry', { error: retryErr.message });
                                    }
                                }
                            } else if (isCircuitBlocked) {
                                const isHalfOpenThrottled = omdbError.code === 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED';
                                if (isHalfOpenThrottled) {
                                    this.logger.debug('OMDb circuit breaker HALF_OPEN throttled request; queuing for OMDb retry', {
                                        title: enrichPayload.title,
                                        code: omdbError.code
                                    });
                                } else {
                                    const now = Date.now();
                                    if ((now - this.lastOmdbCircuitWarnAt) >= OMDB_CIRCUIT_WARN_THROTTLE_MS) {
                                        this.lastOmdbCircuitWarnAt = now;
                                        this.logger.warn('OMDb circuit breaker blocking enrichment; queuing for OMDb retry', {
                                            title: enrichPayload.title,
                                            code: omdbError.code,
                                            nextAttempt: omdbError.nextAttempt ? new Date(omdbError.nextAttempt).toISOString() : null
                                        });
                                    } else {
                                        this.logger.debug('OMDb circuit breaker block warning suppressed', {
                                            title: enrichPayload.title,
                                            code: omdbError.code
                                        });
                                    }
                                }

                                if (enrichPayload.itemId) {
                                    try {
                                        const enrichmentRetryService = require('./enrichmentRetryService');
                                        await enrichmentRetryService.queueForRetry(
                                            enrichPayload.itemId,
                                            'omdb',
                                            `OMDb circuit breaker: ${omdbError.code}`,
                                            6
                                        );
                                    } catch (retryErr) {
                                        this.logger.debug('Failed to queue for retry', { error: retryErr.message });
                                    }
                                }
                            } else {
                                this.logger.warn('OMDb enrichment failed; queuing for OMDb retry', { error: omdbError.message });
                                if (enrichPayload.itemId) {
                                    try {
                                        const enrichmentRetryService = require('./enrichmentRetryService');
                                        await enrichmentRetryService.queueForRetry(
                                            enrichPayload.itemId,
                                            'omdb',
                                            `OMDb error: ${omdbError.message?.substring(0, 100)}`,
                                            7
                                        );
                                    } catch (retryErr) {
                                        this.logger.debug('Failed to queue for retry', { error: retryErr.message });
                                    }
                                }
                            }
                            // Continue without OMDb data
                        }
                    } // end if (!this.omdbLimitHit)
                    // ========== TAVILY ENRICHMENT (SECONDARY) ==========
                    // Tavily provides: content advisory, reviews, holiday detection, anime info
                    // This supplements OMDb with web-scraped content
                    try {
                        const tavilyConfig = await this.db.query('SELECT * FROM tavily_config WHERE is_active = true LIMIT 1');

                        if (tavilyConfig.rows.length > 0 && tavilyConfig.rows[0].api_key) {
                            const config = tavilyConfig.rows[0];
                            const tavilyService = require('./tavily');

                            const searchOptions = {
                                apiKey: config.api_key,
                                searchDepth: config.search_depth || 'advanced',
                                maxResults: config.max_results || 3
                            };

                            // Get content advisory (parents guide, violence, etc.)
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
                                this.logger.debug('Tavily advisory search failed', { error: advisoryError.message });
                            }

                            // Check if holiday/Christmas content
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
                                this.logger.debug('Tavily holiday search failed', { error: holidayError.message });
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
                                    this.logger.debug('Tavily anime search failed', { error: animeError.message });
                                }
                            }
                        }
                    } catch (tavilyError) {
                        this.logger.warn('Tavily enrichment failed', { error: tavilyError.message });
                        // Continue without Tavily data
                    }

                    // Update the item's metadata with all enrichment data
                    if (enrichPayload.itemId) {
                        // Force set content_analysis to mark item as processed
                        // This prevents Gap Analysis from re-queuing it
                        enrichmentData.content_analysis = {
                            type: enrichPayload.media?.media_type || 'unknown',
                            confidence: 100,
                            method: 'source_library',
                            detected_at: new Date().toISOString()
                        };

                        // ========== TVDB/IMDB → TMDB CONVERSION ==========
                        // If we don't have TMDB ID, try to discover it from other provider IDs
                        if (!enrichTmdbId) {
                            // Using injected this.tmdbService

                            // Try TVDB → TMDB first (common for TV shows)
                            if (!enrichTmdbId && enrichPayload.tvdb_id) {
                                try {
                                    const tvdbLookup = await this.tmdbService.findByExternalId(enrichPayload.tvdb_id, 'tvdb_id');
                                    const tvResults = tvdbLookup.tv_results || [];
                                    if (tvResults.length > 0) {
                                        enrichTmdbId = tvResults[0].id;
                                        this.logger.info('TVDB→TMDB conversion successful', {
                                            tvdbId: enrichPayload.tvdb_id,
                                            tmdbId: enrichTmdbId,
                                            title: enrichPayload.title
                                        });
                                    }
                                } catch (e) {
                                    this.logger.debug('TVDB→TMDB lookup failed', { error: e.message });
                                }
                            }

                            // Try IMDB → TMDB (from OMDb enrichment or payload)
                            const imdbId = enrichmentData.omdb?.data?.imdbID || enrichPayload.imdb_id;
                            if (!enrichTmdbId && imdbId) {
                                try {
                                    const imdbLookup = await this.tmdbService.findByExternalId(imdbId, 'imdb_id');
                                    const results = imdbLookup.movie_results?.length > 0
                                        ? imdbLookup.movie_results
                                        : imdbLookup.tv_results || [];
                                    if (results.length > 0) {
                                        enrichTmdbId = results[0].id;
                                        this.logger.info('IMDB→TMDB conversion successful', {
                                            imdbId: imdbId,
                                            tmdbId: enrichTmdbId,
                                            title: enrichPayload.title
                                        });
                                    }
                                } catch (e) {
                                    this.logger.debug('IMDB→TMDB lookup failed', { error: e.message });
                                }
                            }

                            // ========== TMDB TITLE SEARCH (FINAL FALLBACK) ==========
                            // If still no TMDB ID, try searching TMDB by title and year
                            if (!enrichTmdbId && enrichPayload.title) {
                                try {
                                    const mediaType = enrichPayload.media?.media_type || 'movie';
                                    const searchQuery = enrichPayload.year
                                        ? `${enrichPayload.title} ${enrichPayload.year}`
                                        : enrichPayload.title;

                                    const searchResults = await this.tmdbService.search(searchQuery, mediaType);

                                    if (searchResults && searchResults.length > 0) {
                                        // Find best match - prioritize exact title + year match
                                        const bestMatch = searchResults.find(r =>
                                            r.title?.toLowerCase() === enrichPayload.title?.toLowerCase() &&
                                            (!enrichPayload.year || r.year === String(enrichPayload.year))
                                        ) || searchResults[0];

                                        enrichTmdbId = bestMatch.id;
                                        this.logger.info('TMDB title search successful', {
                                            query: searchQuery,
                                            tmdbId: enrichTmdbId,
                                            matchedTitle: bestMatch.title,
                                            title: enrichPayload.title
                                        });
                                    }
                                } catch (e) {
                                    this.logger.debug('TMDB title search failed', { error: e.message });
                                }
                            }

                            // If we discovered TMDB ID, backfill it to media_server_items
                            if (enrichTmdbId && enrichPayload.itemId) {
                                await this._queryWithTimeout(
                                    'UPDATE media_server_items SET tmdb_id = $1 WHERE id = $2 AND tmdb_id IS NULL',
                                    [enrichTmdbId, enrichPayload.itemId]
                                );
                                this.logger.info('Backfilled TMDB ID to media_server_items', {
                                    itemId: enrichPayload.itemId,
                                    tmdbId: enrichTmdbId
                                });
                            }
                        }


                        await this._queryWithTimeout(
                            `UPDATE media_server_items 
                             SET metadata = metadata || $1::jsonb
                             WHERE id = $2`,
                            [JSON.stringify(enrichmentData), enrichPayload.itemId]
                        );

                        // Log to classification_history so it shows in Activity stream
                        // This is 100% confidence from source library - NO AI analysis
                        // Now logs ALL items with a library ID (TMDB optional for visibility)
                        if (enrichSourceLibraryId) {
                            // Verify library still exists before inserting (may have been deleted during sync)
                            const libraryExists = await this.db.query(
                                `SELECT 1 FROM libraries WHERE id = $1 LIMIT 1`,
                                [enrichSourceLibraryId]
                            );

                            if (libraryExists.rows.length > 0) {
                                // Check for duplicates using itemId OR tmdb_id (handle both cases)
                                const existingEntry = enrichTmdbId
                                    ? await this.db.query(
                                        `SELECT 1 FROM classification_history 
                                         WHERE tmdb_id = $1 AND library_id = $2 AND method = 'source_library' LIMIT 1`,
                                        [enrichTmdbId, enrichSourceLibraryId]
                                    )
                                    : await this.db.query(
                                        `SELECT 1 FROM classification_history 
                                         WHERE title = $1 AND library_id = $2 AND method = 'source_library' AND tmdb_id IS NULL LIMIT 1`,
                                        [enrichPayload.title, enrichSourceLibraryId]
                                    );

                                if (existingEntry.rows.length === 0) {
                                    const ragGraphExtractor = require('./ragGraphExtractor');
                                    const graphRel = ragGraphExtractor.extract(enrichPayload);

                                    await this.db.query(
                                        `INSERT INTO classification_history (
                                            tmdb_id, media_type, title, year, library_id, status, 
                                            confidence, method, reason, metadata,
                                            director_name, primary_studio_name, genre_names, cast_ids, cast_names
                                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                                        [
                                            enrichTmdbId || null,  // Now allows NULL
                                            enrichPayload.media?.media_type || 'movie',
                                            enrichPayload.title,
                                            enrichPayload.year,
                                            enrichSourceLibraryId,
                                            'completed',
                                            100, // 100% confidence from source
                                            'source_library', // Method is source_library, not AI
                                            enrichTmdbId
                                                ? `Already in library: ${enrichSourceLibraryName}`
                                                : `Already in library: ${enrichSourceLibraryName} (no TMDB match)`,
                                            JSON.stringify(enrichPayload),
                                            graphRel.director_name,
                                            graphRel.primary_studio_name,
                                            graphRel.genre_names,
                                            graphRel.cast_ids,
                                            graphRel.cast_names
                                        ]
                                    );
                                }
                            } else {
                                this.logger.warn('Library deleted during task processing, skipping classification_history insert', {
                                    libraryId: enrichSourceLibraryId,
                                    taskId: task.id,
                                    title: enrichPayload.title
                                });
                            }
                        }


                        const hasTavily = !!(enrichmentData.tavily_imdb || enrichmentData.tavily_advisory || enrichmentData.tavily_content_type || enrichmentData.tavily_holiday);
                        this.logger.info('Metadata enrichment complete (no AI, from source library)', {
                            itemId: enrichPayload.itemId,
                            title: enrichPayload.title,
                            sourceLibrary: enrichSourceLibraryName,
                            tavilyEnriched: hasTavily
                        });
                    }

                    await this.completeTask(task.id, {
                        enriched: true,
                        sourceLibrary: enrichPayload.source_library_name,
                        tavilyEnriched: !!(enrichmentData.tavily_imdb || enrichmentData.tavily_advisory)
                    });
                    break;

                case 'rating_normalization':
                    await this.processRatingNormalization(task);
                    break;

                case 'rebuild_hnsw_index': {
                    // Rebuilds image embedding indexes deferred from the dimension-mismatch auto-heal
                    // in embeddingService.storeImageEmbedding(). HNSW builds are CPU-proportional to
                    // table size and can block for minutes inside a transaction; running them here via
                    // CREATE INDEX CONCURRENTLY avoids ACCESS EXCLUSIVE lock contention during writes.
                    // IMPORTANT: CREATE INDEX CONCURRENTLY must NOT run inside a transaction block.
                    // pool-level db.query() uses per-statement autocommit — withTransaction() must
                    // never be used for these statements.
                    this.logger.info('Rebuilding deferred HNSW and B-tree image indexes...');
                    await this.db.query(`
                        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_image_hnsw
                        ON classification_embeddings USING hnsw (image_embedding vector_cosine_ops)
                        WITH (m = 16, ef_construction = 64)
                    `);
                    await this.db.query(`
                        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_image_present
                        ON classification_embeddings (image_provider, image_model)
                        WHERE image_embedding IS NOT NULL
                    `);
                    await this.db.query(`
                        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_image_hash
                        ON classification_embeddings (image_embedding_hash, image_model, image_embedding_size)
                        WHERE image_embedding_hash IS NOT NULL
                    `);
                    this.logger.info('HNSW and supporting image indexes rebuilt successfully.');
                    await this.completeTask(task.id, {
                        rebuilt: true,
                        indexes: [
                            'idx_embeddings_image_hnsw',
                            'idx_embeddings_image_present',
                            'idx_embeddings_image_hash'
                        ]
                    });
                    break;
                }

                default:
                    this.logger.warn('Unknown task type', { taskType: task.task_type });
                    await this.failTask(task.id, `Unknown task type: ${task.task_type}`, task.attempts, task.max_attempts);
            }
        } catch (error) {
            this.logger.error('Task processing failed', { taskId: task.id, error: error.message });
            await this.failTask(task.id, error.message, task.attempts, task.max_attempts);

            // Update webhook_log if linked
            if (task.webhook_log_id) {
                await this.db.query(
                    `UPDATE webhook_log SET processing_status = 'failed', error_message = $2 WHERE id = $1`,
                    [task.webhook_log_id, error.message]
                );
            }
        }
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
        if (this.running) {
            this.logger.warn('Worker already running');
            return;
        }

        // Reset any zombie tasks from previous crashes
        await this.resetStaleProcessingTasks();

        // If the task_queue has accumulated excessive completed/failed rows
        // (e.g. after the daily cleanup job was missing or the instance was
        // running for a long time without a purge), drain them now in the
        // background so they don't inflate query costs during this session.
        // Non-blocking: the worker loop starts immediately.
        this._backgroundDrainIfBloated().catch(err => {
            this.logger.warn('Background task_queue drain failed', { error: err.message });
        });

        this.running = true;
        this.logger.info('Queue worker started');

        while (this.running) {
            // Periodic visibility-timeout recovery — runs every VISIBILITY_RECOVERY_INTERVAL_MS.
            // Re-queues any processing tasks whose window has expired due to worker crash/OOM.
            const now = Date.now();
            if (now - this.lastRecoveryCheck >= VISIBILITY_RECOVERY_INTERVAL_MS) {
                this.lastRecoveryCheck = now;
                this.recoverExpiredVisibilityTasks().catch(err => {
                    this.logger.error('Visibility timeout recovery failed', { error: err.message });
                });
            }

            // Stall detection: warn if all worker slots stay occupied for >30 s.
            // This surfaces row-lock contention (e.g. concurrent Plex sync) in the logs
            // so the issue can be diagnosed without needing to restart the service.
            if (this.processing >= MAX_CONCURRENT) {
                if (this.fullConcurrencyStartedAt === 0) {
                    this.fullConcurrencyStartedAt = now;
                } else if (now - this.fullConcurrencyStartedAt >= 30_000) {
                    this.logger.warn('Worker at max concurrency for >30 s — possible row-lock stall; tasks will self-recover via statement timeout or visibility window', {
                        processing: this.processing,
                        maxConcurrent: MAX_CONCURRENT,
                        durationMs: now - this.fullConcurrencyStartedAt,
                    });
                    this.fullConcurrencyStartedAt = now; // Reset so it re-warns every 30 s, not every tick
                }
            } else {
                this.fullConcurrencyStartedAt = 0;
            }

            try {
                if (this.processing < MAX_CONCURRENT) {
                    const task = await this.dequeue();

                    if (task) {
                        // Only check AI availability for classification tasks
                        // metadata_enrichment tasks don't need AI
                        if (task.task_type === 'classification') {
                            const aiReady = await this.checkAIAvailability();
                            if (!aiReady) {
                                // Put task back in queue
                                await this.db.query(
                                    `UPDATE task_queue SET status = 'pending', started_at = NULL, visible_at = NULL WHERE id = $1`,
                                    [task.id]
                                );
                                // Wait and continue
                                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
                                continue;
                            }
                        }

                        this.processing++;
                        this.processTask(task).finally(() => {
                            this.processing--;
                        });

                        // If we found a task, don't wait - check for more work immediately
                        // Small delay to yield to event loop
                        await new Promise(resolve => setImmediate(resolve));
                        continue;
                    }
                }
            } catch (error) {
                this.logger.error('Worker loop error', { error: error.message });
            }

            // Wait before next poll if no task was found or max concurrent reached
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        this.logger.info('Queue worker stopped');
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
        try {
            // Only count classification tasks - metadata_enrichment is tracked separately
            // in Library Enrichment Progress on the dashboard
            const result = await this.db.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM task_queue
        WHERE task_type = 'classification'
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

            stats.aiAvailable = this.aiAvailable;
            stats.workerRunning = this.running;

            return stats;
        } catch (error) {
            this.logger.error('Failed to get queue stats', { error: error.message });
            return null;
        }
    }

    /**
     * Get gap analysis statistics for progress indicator
     */
    async getGapAnalysisStats() {
        try {
            // Count items that still need to be analyzed
            const unprocessedResult = await this.db.query(`
                SELECT COUNT(*) as count 
                FROM media_server_items 
                WHERE metadata->'content_analysis' IS NULL
            `);

            // Get total items count
            const totalResult = await this.db.query(`
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
            this.logger.error('Failed to get gap analysis stats', { error: error.message });
            return null;
        }
    }

    /**
     * Get pending tasks
     */
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
            return [];
        }
    }

    /**
     * Get failed tasks
     */
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
            return [];
        }
    }

    /**
     * Retry a failed task
     */
    async retryTask(taskId) {
        try {
            await this.db.query(
                `UPDATE task_queue
         SET status = 'pending', attempts = 0, error_message = NULL, next_retry_at = NOW()
         WHERE id = $1 AND status = 'failed'`,
                [taskId]
            );
            this.logger.info('Task queued for retry', { taskId });
            return true;
        } catch (error) {
            this.logger.error('Failed to retry task', { error: error.message, taskId });
            return false;
        }
    }

    /**
     * Dismiss a failed task
     */
    async dismissFailedTask(taskId) {
        try {
            const result = await this.db.query(
                `DELETE FROM task_queue
         WHERE id = $1 AND status = 'failed'
         RETURNING id`,
                [taskId]
            );
            this.logger.info('Failed task dismissed', { taskId, dismissed: result.rowCount > 0 });
            return result.rowCount > 0;
        } catch (error) {
            this.logger.error('Failed to dismiss task', { error: error.message, taskId });
            return false;
        }
    }

    /**
     * Cancel a pending task
     */
    async cancelTask(taskId) {
        try {
            await this.db.query(
                `UPDATE task_queue
         SET status = 'cancelled', completed_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
                [taskId]
            );
            this.logger.info('Task cancelled', { taskId });
            return true;
        } catch (error) {
            this.logger.error('Failed to cancel task', { error: error.message, taskId });
            return false;
        }
    }

    /**
     * Clear all completed tasks
     */
    async clearCompletedTasks() {
        try {
            const result = await this.db.query(
                `DELETE FROM task_queue WHERE status = 'completed'`
            );
            this.logger.info('Cleared completed tasks', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            this.logger.error('Failed to clear completed tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Clear all failed tasks
     */
    async clearFailedTasks() {
        try {
            const result = await this.db.query(
                `DELETE FROM task_queue WHERE status = 'failed'`
            );
            this.logger.info('Cleared failed tasks', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            this.logger.error('Failed to clear failed tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Retry all failed tasks
     */
    async retryAllFailedTasks() {
        try {
            const result = await this.db.query(
                `UPDATE task_queue
         SET status = 'pending', attempts = 0, error_message = NULL, next_retry_at = NOW()
         WHERE status = 'failed'
         RETURNING id`
            );
            this.logger.info('Retrying all failed tasks', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            this.logger.error('Failed to retry all tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Cancel all pending tasks
     */
    async cancelAllPendingTasks() {
        try {
            const result = await this.db.query(
                `UPDATE task_queue
         SET status = 'cancelled', completed_at = NOW()
         WHERE status = 'pending'
         RETURNING id`
            );
            this.logger.info('Cancelled all pending tasks', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            this.logger.error('Failed to cancel all tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Re-queue all completed classifications for reprocessing with updated rules
     */
    async reprocessCompleted() {
        try {
            // Get all completed items from classification history
            const historyResult = await this.db.query(
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

            this.logger.info('Queued completed items for reprocessing', { count });
            return count;
        } catch (error) {
            this.logger.error('Failed to reprocess completed', { error: error.message });
            throw error;
        }
    }

    /**
     * Build library snapshot with external IDs AND mappings before clearing
     * Captures library info and mapping info needed to restore after re-sync
     */
    async buildLibrarySnapshot() {
        try {
            const librariesResult = await this.db.query(`
                SELECT
                    l.id,
                    l.name,
                    l.media_type,
                    l.external_id,
                    ms.type as media_server_type
                FROM libraries l
                LEFT JOIN media_server ms ON l.media_server_id = ms.id
            `);

            const mappingsResult = await this.db.query(`
                SELECT * FROM library_arr_mappings
            `);

            const snapshot = {
                libraries: {},
                mappings: mappingsResult.rows
            };

            for (const lib of librariesResult.rows) {
                snapshot.libraries[lib.id] = {
                    name: lib.name,
                    media_type: lib.media_type,
                    external_id: lib.external_id,
                    media_server_type: lib.media_server_type
                };
            }

            this.logger.info('Built library snapshot', {
                libraryCount: Object.keys(snapshot.libraries).length,
                mappingCount: snapshot.mappings.length
            });
            return snapshot;
        } catch (error) {
            this.logger.error('Failed to build library snapshot', { error: error.message });
            throw error;
        }
    }

    /**
     * Build new library lookup after re-sync
     * Creates lookup tables by external ID, name+type for matching
     */
    async buildNewLibraryLookup() {
        try {
            const result = await this.db.query(`
                SELECT
                    l.id,
                    l.name,
                    l.media_type,
                    l.external_id,
                    ms.type as media_server_type
                FROM libraries l
                LEFT JOIN media_server ms ON l.media_server_id = ms.id
            `);

            const lookup = {
                byExternalId: {},
                byNameType: {}
            };

            for (const lib of result.rows) {
                // Index by external_id (most reliable)
                if (lib.external_id && lib.media_server_type) {
                    const key = `${lib.media_server_type}:${lib.external_id}`;
                    lookup.byExternalId[key] = lib.id;
                }

                // Index by name + media_type (fallback)
                const nameKey = `${lib.name.toLowerCase()}|${lib.media_type}`;
                lookup.byNameType[nameKey] = lib.id;
            }

            this.logger.info('Built new library lookup', {
                byExternalId: Object.keys(lookup.byExternalId).length,
                byNameType: Object.keys(lookup.byNameType).length
            });

            return lookup;
        } catch (error) {
            this.logger.error('Failed to build library lookup', { error: error.message });
            throw error;
        }
    }

    /**
     * Find new library ID using priority matching
     * Priority: external_id (most reliable) > name+type (fallback)
     */
    findNewLibraryId(oldLibInfo, newLookup) {
        // Priority 1: Match by external_id from same media server type
        if (oldLibInfo.external_id && oldLibInfo.media_server_type) {
            const key = `${oldLibInfo.media_server_type}:${oldLibInfo.external_id}`;
            if (newLookup.byExternalId[key]) {
                return newLookup.byExternalId[key];
            }
        }

        // Priority 2: Match by name + media_type
        const nameKey = `${oldLibInfo.name.toLowerCase()}|${oldLibInfo.media_type}`;
        if (newLookup.byNameType[nameKey]) {
            return newLookup.byNameType[nameKey];
        }

        return null; // Cannot remap
    }

    /**
     * Remap mappings for a single *arr instance
     * Recreates mappings that were CASCADE deleted when libraries were cleared
     */
    async remapInstanceMappings(type, config, snapshot, newLookup) {
        const result = {
            remapped: 0,
            failed: 0,
            failedLibraries: []
        };

        try {
            // Find mappings for this instance in the snapshot
            const instanceMappings = snapshot.mappings.filter(
                m => m.arr_type === type && m.arr_config_id === config.id
            );

            if (instanceMappings.length === 0) {
                this.logger.debug('No mappings found in snapshot for instance', {
                    type,
                    configId: config.id
                });
                return result;
            }

            for (const mapping of instanceMappings) {
                const oldLibInfo = snapshot.libraries[mapping.library_id];

                if (!oldLibInfo) {
                    result.failed++;
                    result.failedLibraries.push({
                        oldId: mapping.library_id,
                        reason: 'Library not found in snapshot'
                    });
                    continue;
                }

                const newLibraryId = this.findNewLibraryId(oldLibInfo, newLookup);

                if (newLibraryId) {
                    // Recreate the mapping with new library_id
                    await this.db.query(
                        `INSERT INTO library_arr_mappings 
                         (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path, 
                          quality_profile_id, plex_path_prefix, arr_path_prefix, classifarr_path_prefix)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         ON CONFLICT (library_id) DO UPDATE SET
                            arr_type = EXCLUDED.arr_type,
                            arr_config_id = EXCLUDED.arr_config_id,
                            arr_root_folder_id = EXCLUDED.arr_root_folder_id,
                            arr_root_folder_path = EXCLUDED.arr_root_folder_path,
                            quality_profile_id = EXCLUDED.quality_profile_id,
                            plex_path_prefix = EXCLUDED.plex_path_prefix,
                            arr_path_prefix = EXCLUDED.arr_path_prefix,
                            classifarr_path_prefix = EXCLUDED.classifarr_path_prefix,
                            updated_at = NOW()`,
                        [
                            newLibraryId,
                            mapping.arr_type,
                            mapping.arr_config_id,
                            mapping.arr_root_folder_id,
                            mapping.arr_root_folder_path,
                            mapping.quality_profile_id,
                            mapping.plex_path_prefix,
                            mapping.arr_path_prefix,
                            mapping.classifarr_path_prefix
                        ]
                    );

                    result.remapped++;

                    this.logger.info('Restored library mapping', {
                        instance: `${type} ${config.id}`,
                        oldId: mapping.library_id,
                        newId: newLibraryId,
                        name: oldLibInfo.name,
                        arr_root_folder: mapping.arr_root_folder_path
                    });
                } else {
                    result.failed++;
                    result.failedLibraries.push({
                        oldId: mapping.library_id,
                        name: oldLibInfo.name,
                        reason: 'No matching library found after re-sync'
                    });
                }
            }

            return result;
        } catch (error) {
            this.logger.error('Failed to remap instance mappings', {
                type,
                configId: config.id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Remap library mappings for ALL Radarr and Sonarr instances
     */
    async remapAllArrMappings(oldLibrarySnapshot, newLibraryLookup) {
        const results = {
            radarr: [],
            sonarr: [],
            totalRemapped: 0,
            totalFailed: 0
        };

        try {
            // Process ALL Radarr instances
            const radarrConfigs = await this.db.query('SELECT * FROM radarr_config');

            for (const config of radarrConfigs.rows) {
                const instanceResult = await this.remapInstanceMappings(
                    'radarr',
                    config,
                    oldLibrarySnapshot,
                    newLibraryLookup
                );

                results.radarr.push({
                    id: config.id,
                    name: config.name || `Radarr ${config.id}`,
                    remapped: instanceResult.remapped,
                    failed: instanceResult.failed,
                    failedLibraries: instanceResult.failedLibraries
                });

                results.totalRemapped += instanceResult.remapped;
                results.totalFailed += instanceResult.failed;
            }

            // Process ALL Sonarr instances
            const sonarrConfigs = await this.db.query('SELECT * FROM sonarr_config');

            for (const config of sonarrConfigs.rows) {
                const instanceResult = await this.remapInstanceMappings(
                    'sonarr',
                    config,
                    oldLibrarySnapshot,
                    newLibraryLookup
                );

                results.sonarr.push({
                    id: config.id,
                    name: config.name || `Sonarr ${config.id}`,
                    remapped: instanceResult.remapped,
                    failed: instanceResult.failed,
                    failedLibraries: instanceResult.failedLibraries
                });

                results.totalRemapped += instanceResult.remapped;
                results.totalFailed += instanceResult.failed;
            }

            this.logger.info('Library mapping restoration complete', {
                totalRemapped: results.totalRemapped,
                totalFailed: results.totalFailed
            });

            return results;
        } catch (error) {
            this.logger.error('Failed to remap all arr mappings', { error: error.message });
            throw error;
        }
    }

    /**
     * Notify user about mappings that couldn't be restored
     */
    async createRemapFailureNotification(results) {
        if (results.totalFailed === 0) return;

        try {
            const failedDetails = [];

            // Separate radarr and sonarr instances for clearer type detection
            for (const instance of results.radarr) {
                if (instance.failed > 0) {
                    failedDetails.push({
                        type: 'radarr',
                        instanceId: instance.id,
                        instanceName: instance.name,
                        failedLibraries: instance.failedLibraries
                    });
                }
            }

            for (const instance of results.sonarr) {
                if (instance.failed > 0) {
                    failedDetails.push({
                        type: 'sonarr',
                        instanceId: instance.id,
                        instanceName: instance.name,
                        failedLibraries: instance.failedLibraries
                    });
                }
            }

            await this.db.query(`
                INSERT INTO app_notifications (type, title, message, data, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `, [
                'warning',
                'Some library mappings need attention',
                `${results.totalFailed} library mapping(s) could not be automatically restored after CARSA. Please review and reconfigure them manually.`,
                JSON.stringify(failedDetails)
            ]);

            this.logger.warn('Created notification for failed mappings', {
                totalFailed: results.totalFailed,
                details: failedDetails
            });
        } catch (error) {
            this.logger.error('Failed to create remap failure notification', { error: error.message });
            // Don't throw - this is non-critical
        }
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
            await client.query(`SET LOCAL statement_timeout = '${timeoutMs}'`);
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
        if (typeof this.db.connect !== 'function') {
            return work(this.db);
        }

        const client = await this.db.connect();
        try {
            await client.query('BEGIN');
            const result = await work(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                this.logger.warn('Failed to rollback transaction', {
                    context,
                    error: rollbackError.message
                });
                error.rollbackFailed = true;
                error.rollbackError = rollbackError.message;
            }
            throw error;
        } finally {
            client.release();
        }
    }

    isForeignKeyConstraintError(error) {
        const code = typeof error?.code === 'string' ? error.code.trim() : '';
        const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
        return code === '23503' || message.includes('violates foreign key constraint');
    }

    normalizeClearAndResyncError(error) {
        if (error?.code === 'CARSA_DEPENDENCY_CONFLICT' || error?.code === 'CARSA_RESET_FAILED') {
            return error;
        }

        if (this.isForeignKeyConstraintError(error)) {
            const constraint = (error.message || '').match(/constraint "([^"]+)"/i)?.[1] || null;
            const table = (error.message || '').match(/on table "([^"]+)"/i)?.[1] || null;
            const dependencyError = new Error(
                `CARSA blocked by dependent rows${table ? ` on ${table}` : ''}${constraint ? ` (${constraint})` : ''}`
            );
            dependencyError.code = 'CARSA_DEPENDENCY_CONFLICT';
            dependencyError.details = {
                table,
                constraint,
                originalError: error.message || null
            };
            return dependencyError;
        }

        const resetError = new Error(error?.message || 'Failed to clear and resync');
        resetError.code = 'CARSA_RESET_FAILED';
        resetError.details = {
            originalError: error?.message || null
        };
        return resetError;
    }

    async performClearAndResyncCleanup() {
        // LOCK TABLE requires an explicit transaction block. Use db.withTransaction
        // (available on the real database module) to guarantee one. Falls back to
        // withOptionalTransaction for test environments where withTransaction is not
        // a real implementation.
        const transact = typeof this.db.withTransaction === 'function'
            ? (fn) => this.db.withTransaction(fn)
            : (fn) => this.withOptionalTransaction(fn, 'clear_and_resync');

        return transact(async (dbClient) => {
            // Prevent concurrent writes that can recreate FK dependencies mid-CARSA.
            await dbClient.query('LOCK TABLE libraries, media_server_sync_status IN SHARE ROW EXCLUSIVE MODE');

            this.syncStatus.updateProgress(20, 'Clearing task queue...');
            const queueResult = await dbClient.query('DELETE FROM task_queue RETURNING id');

            // Clear content_analysis_log first (references classification_history)
            await dbClient.query('DELETE FROM content_analysis_log');

            // Clear classification_embeddings BEFORE classification_history (FK dependency)
            const embeddingsResult = await dbClient.query('DELETE FROM classification_embeddings RETURNING id');

            this.syncStatus.updateProgress(30, 'Clearing embeddings...');

            // Clear classification history
            const historyResult = await dbClient.query('DELETE FROM classification_history RETURNING id');

            this.syncStatus.updateProgress(40, 'Clearing classification history...');

            // Clear learning patterns and corrections (full reset)
            const patternsResult = await dbClient.query('DELETE FROM learning_patterns RETURNING id');
            const correctionsResult = await dbClient.query('DELETE FROM classification_corrections RETURNING id');

            this.syncStatus.updateProgress(50, 'Clearing learning data...');

            // Clear ALL library classification rules
            const rulesV2Result = await dbClient.query('DELETE FROM library_rules_v2 RETURNING id');
            await dbClient.query('DELETE FROM library_custom_rules');

            // Clear library pattern suggestions (Available Library Filters)
            await dbClient.query('DELETE FROM library_pattern_suggestions');

            this.syncStatus.updateProgress(60, 'Clearing library rules...');

            // Clear library_profiles (references libraries)
            await dbClient.query('DELETE FROM library_profiles');

            // Preserve policy feedback rows while removing stale library references.
            let feedbackLibraryRefsCleared = 0;
            try {
                const feedbackResult = await dbClient.query(`
                    UPDATE policy_feedback_log
                    SET selected_library_id = NULL
                    WHERE selected_library_id IS NOT NULL
                `);
                feedbackLibraryRefsCleared = feedbackResult.rowCount || 0;
            } catch (error) {
                // Older installs may not yet have this table.
                if (error.code !== '42P01') {
                    throw error;
                }
                this.logger.debug('policy_feedback_log not present; skipping selected_library_id cleanup');
            }

            // Clear media_server_sync_status (references libraries, non-cascading FK)
            const syncStatusRowsResult = await dbClient.query('DELETE FROM media_server_sync_status RETURNING id');

            // Clear media_server_collections (references libraries)
            const collectionsResult = await dbClient.query('DELETE FROM media_server_collections RETURNING id');

            // Clear media_server_items (references libraries)
            const itemsResult = await dbClient.query('DELETE FROM media_server_items RETURNING id');

            this.syncStatus.updateProgress(70, 'Clearing media items...');

            // Clear libraries (parent table) - library_arr_mappings CASCADE deleted
            // Mappings are recreated after re-sync using snapshot data.
            const librariesResult = await dbClient.query('DELETE FROM libraries RETURNING id');

            return {
                queueResult,
                embeddingsResult,
                historyResult,
                patternsResult,
                correctionsResult,
                rulesV2Result,
                syncStatusRowsResult,
                collectionsResult,
                itemsResult,
                librariesResult,
                feedbackLibraryRefsCleared
            };
        });
    }

    async clearAndResync() {
        const wasRunning = this.running;
        try {
            // CARSA always runs - force stop any active sync
            if (this.syncStatus.isRunning) {
                this.logger.info('CARSA interrupting active sync', { type: this.syncStatus.type });
                this.syncStatus.forceStop();
            }

            // Start CARSA sync status (marked non-interruptible for tracking purposes)
            this.syncStatus.start('full_resync', false);

            this.logger.info('Starting clear and resync process...');

            // 1. SNAPSHOT: Capture library info BEFORE clear
            this.syncStatus.updateProgress(5, 'Capturing library snapshot...');
            const oldLibrarySnapshot = await this.buildLibrarySnapshot();

            this.logger.info('Captured pre-clear snapshot', {
                libraries: Object.keys(oldLibrarySnapshot.libraries).length,
                mappings: oldLibrarySnapshot.mappings.length
            });

            // 2. Stop worker and drain in-flight tasks before clearing data.
            // stopWorker() flips this.running = false so the loop exits on its
            // next iteration, but processTask() calls already dispatched continue
            // running asynchronously.  We must wait for this.processing to reach
            // zero before truncating tables, otherwise those tasks will attempt
            // writes against rows (e.g. libraries) that no longer exist and emit
            // spurious WARN logs for a race that CARSA itself created.
            if (wasRunning) {
                this.stopWorker();
                const DRAIN_POLL_MS = 100;
                const DRAIN_TIMEOUT_MS = 15_000;
                const drainDeadline = Date.now() + DRAIN_TIMEOUT_MS;
                while (this.processing > 0 && Date.now() < drainDeadline) {
                    await new Promise(resolve => setTimeout(resolve, DRAIN_POLL_MS));
                }
                if (this.processing > 0) {
                    this.logger.warn('CARSA proceeding with in-flight tasks still active after drain timeout', {
                        inFlight: this.processing,
                        drainTimeoutMs: DRAIN_TIMEOUT_MS,
                    });
                }
            }

            this.syncStatus.updateProgress(10, 'Stopping worker...');

            const cleanupResult = await this.performClearAndResyncCleanup();
            const {
                queueResult,
                embeddingsResult,
                historyResult,
                patternsResult,
                correctionsResult,
                rulesV2Result,
                syncStatusRowsResult,
                collectionsResult,
                itemsResult,
                librariesResult,
                feedbackLibraryRefsCleared
            } = cleanupResult;

            this.logger.info('Cleared all synced data', {
                queue: queueResult.rowCount,
                embeddings: embeddingsResult.rowCount,
                history: historyResult.rowCount,
                patterns: patternsResult.rowCount,
                corrections: correctionsResult.rowCount,
                rules: rulesV2Result.rowCount,
                syncStatusRows: syncStatusRowsResult.rowCount,
                collections: collectionsResult.rowCount,
                items: itemsResult.rowCount,
                libraries: librariesResult.rowCount,
                feedbackLibraryRefsCleared
            });

            // 14. Clear in-memory caches
            this.omdbLimitHit = false; // Reset OMDb limit flag for fresh start
            this.lastOmdbCircuitWarnAt = 0;
            this.lastOmdbSslWarnAt = 0;
            this.omdbSslBlockedUntil = 0;
            this.lastOmdbSslProbeAt = 0;

            this.syncStatus.updateProgress(75, 'Restarting worker...');

            // 15. Restart worker if it was running
            if (wasRunning) {
                this.startWorker();
            }

            this.syncStatus.updateProgress(80, 'Starting fresh sync...');

            // 16. Trigger FRESH library sync from media server
            // This runs in background so we don't block the response
            const mediaSyncService = require('./mediaSync');
            const scheduler = require('./scheduler');

            (async () => {
                try {
                    // ✅ CORRECT: Full sync from media server creates NEW library entries
                    await mediaSyncService.syncAllLibraries();

                    this.logger.info('Fresh library sync completed after clear');

                    this.syncStatus.updateProgress(85, 'Remapping library mappings...');

                    // 17. REMAP: Restore *arr library mappings with new library IDs
                    const newLibraryLookup = await this.buildNewLibraryLookup();

                    const remapResults = await this.remapAllArrMappings(
                        oldLibrarySnapshot,
                        newLibraryLookup
                    );

                    this.logger.info('Library mapping restoration complete', {
                        totalRemapped: remapResults.totalRemapped,
                        totalFailed: remapResults.totalFailed
                    });

                    // 18. NOTIFY: If any mappings failed
                    if (remapResults.totalFailed > 0) {
                        await this.createRemapFailureNotification(remapResults);
                    }

                    this.syncStatus.updateProgress(90, 'Running gap analysis...');

                    // Run gap analysis with new library IDs
                    await scheduler.runGapAnalysis();

                    this.logger.info('Gap analysis triggered after clear');

                    this.syncStatus.updateProgress(100, 'Complete');
                    this.syncStatus.stop();
                } catch (err) {
                    this.logger.error('Failed to run library sync after clear', { error: err.message });
                    this.syncStatus.stop();

                    // Create error notification for user
                    try {
                        await this.db.query(`
                            INSERT INTO app_notifications (type, title, message, data, created_at)
                            VALUES ($1, $2, $3, $4, NOW())
                        `, [
                            'error',
                            'Library sync failed after CARSA',
                            'Failed to complete library re-sync and mapping restoration after Clear and Re-sync All. Please check logs and try again.',
                            JSON.stringify({ error: err.message, timestamp: new Date().toISOString() })
                        ]);
                    } catch (notifErr) {
                        this.logger.error('Failed to create error notification', { error: notifErr.message });
                    }
                }
            })();

            const result = {
                queueCleared: queueResult.rowCount,
                embeddingsCleared: embeddingsResult.rowCount,
                historyCleared: historyResult.rowCount,
                patternsCleared: patternsResult.rowCount,
                correctionsCleared: correctionsResult.rowCount,
                rulesCleared: rulesV2Result.rowCount,
                syncStatusRowsCleared: syncStatusRowsResult.rowCount,
                collectionsCleared: collectionsResult.rowCount,
                itemsReset: itemsResult.rowCount,
                librariesCleared: librariesResult.rowCount,
                feedbackLibraryRefsCleared
            };

            this.logger.info('Cleared queue and triggered resync', result);
            return result;
        } catch (error) {
            const normalizedError = this.normalizeClearAndResyncError(error);
            this.logger.error('Failed to clear and resync', {
                error: normalizedError.message,
                code: normalizedError.code || null,
                details: normalizedError.details || null
            });
            this.syncStatus.stop();

            // CARSA failure should not leave queue processing permanently paused.
            if (wasRunning && !this.running) {
                this.startWorker().catch((restartError) => {
                    this.logger.error('Failed to restart worker after CARSA error', {
                        error: restartError.message
                    });
                });
                this.logger.warn('CARSA failed; worker restart requested');
            }

            throw normalizedError;
        }
    }
    /**
     * Finds items that need analysis and adds them to the queue
     * This is used by the scheduler (gap analysis) and manual ingestion triggers
     */
    /**
     * Drain old completed/failed/cancelled task_queue rows in the background.
     * Called once at worker startup. Loops in batches of 5 000 until no more
     * rows older than TASK_QUEUE_RETENTION_DAYS remain.
     *
     * The drain only fires when the stale row count exceeds BLOAT_THRESHOLD
     * (1 000) to avoid unnecessary DB round-trips on healthy instances.
     */
    async _backgroundDrainIfBloated() {
        const BLOAT_THRESHOLD = 1000;
        const BATCH = 5000;

        const parsed = parseInt(process.env.TASK_QUEUE_RETENTION_DAYS, 10);
        const retentionDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;

        // Quick count check — uses idx_task_queue_cleanup (partial index)
        const countResult = await this.db.query(
            `SELECT COUNT(*) AS n FROM task_queue
             WHERE status IN ('completed', 'failed', 'cancelled')
               AND created_at < NOW() - ($1 || ' days')::INTERVAL`,
            [retentionDays]
        );
        const staleCount = parseInt(countResult.rows[0].n) || 0;

        if (staleCount <= BLOAT_THRESHOLD) return;

        this.logger.warn('task_queue bloat detected at startup; running background drain', {
            staleRows: staleCount,
            retentionDays
        });

        let totalDeleted = 0;
        let batchDeleted;
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
            // Find items that have NO content analysis AND are not already queued
            // Limit to 500 at a time to prevent flooding the queue
            // Find items that need enrichment:
            // 1. Completely unanalyzed items (content_analysis IS NULL)
            // 2. Analyzed items (from Sync or AI) that haven't been through enrichment pipeline (source != metadata_enrichment)
            //    AND are missing OMDb data.
            const result = await this.db.query(
                `SELECT msi.id, msi.title, msi.metadata, msi.genres, msi.tags, msi.content_rating, 
                        msi.tmdb_id, msi.tvdb_id, msi.imdb_id, msi.year,
                        msi.library_id, l.name as library_name, l.media_type
                 FROM media_server_items msi
                 LEFT JOIN libraries l ON msi.library_id = l.id
                 WHERE (
                     msi.metadata->'content_analysis' IS NULL
                     OR (
                         msi.metadata->'omdb' IS NULL
                         AND msi.metadata->'content_analysis'->>'source' IS DISTINCT FROM 'metadata_enrichment'
                     )
                 )
                 AND NOT EXISTS (
                     SELECT 1 FROM task_queue tq 
                     WHERE tq.task_type = 'metadata_enrichment' 
                     AND tq.status IN ('pending', 'processing')
                     AND (tq.payload::json->>'itemId')::int = msi.id
                 )
                 LIMIT 5000`
            );

            if (result.rows.length === 0) {
                this.logger.debug('Refill queue: No unanalyzed items found');
                return { queued: 0 };
            }

            this.logger.info(`Refill queue: Found ${result.rows.length} unanalyzed items. Queueing for metadata enrichment...`);
            let queuedCount = 0;

            for (const item of result.rows) {
                // Use 'metadata_enrichment' for existing Plex content (learning data)
                await this.enqueue('metadata_enrichment', {
                    title: item.title,
                    year: item.year,
                    overview: item.metadata?.summary || '',
                    genres: typeof item.genres === 'string' ? JSON.parse(item.genres) : (item.genres || []),
                    keywords: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
                    content_rating: item.content_rating,
                    original_language: 'en',
                    tmdb_id: item.tmdb_id,
                    tvdb_id: item.tvdb_id,  // Pass for TVDB→TMDB conversion
                    imdb_id: item.imdb_id,  // Pass for IMDB→TMDB conversion
                    posterPath: item.metadata?.posterPath || null,
                    itemId: item.id, // Pass internal ID for efficient updating
                    source_library_id: item.library_id, // Already in this library - just enriching
                    source_library_name: item.library_name,
                    media: { media_type: item.media_type || 'movie' }
                }, {
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
