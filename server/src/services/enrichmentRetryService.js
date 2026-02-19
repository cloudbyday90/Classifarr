/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Enrichment Retry Service - Handles Tavily fallback for OMDb failures
 */

const db = require('../config/database');
const tavilyService = require('./tavily');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EnrichmentRetryService');
const TAVILY_MONTHLY_DEFERRED_REASON = 'tavily_monthly_quota_deferred';
const TAVILY_MONTHLY_DEFERRED_MESSAGE = 'Tavily monthly quota reached; deferred until next month reset';

class EnrichmentRetryService {
    constructor() {
        this.processingScheduled = false;
        this.processingInProgress = false;
        this.scheduledTimeout = null;
    }

    /**
     * Queue an item for enrichment retry
     * @param {number} mediaItemId - The media_server_items.id
     * @param {string} enrichmentType - 'tavily', 'omdb', 'tmdb'
     * @param {string} reason - Why it needs retry
     * @param {number} priority - 1-10, lower = higher priority
     */
    async queueForRetry(mediaItemId, enrichmentType = 'tavily', reason = 'OMDb not found', priority = 5) {
        try {
            await db.query(`
        INSERT INTO enrichment_retry_queue 
          (media_item_id, enrichment_type, reason, priority)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (media_item_id, enrichment_type) DO UPDATE SET
          status = CASE 
            WHEN enrichment_retry_queue.status = 'completed' THEN 'completed'
            WHEN enrichment_retry_queue.status = 'failed' AND enrichment_retry_queue.reason = $5 THEN 'pending'
            WHEN enrichment_retry_queue.status = 'failed' AND enrichment_retry_queue.attempts >= enrichment_retry_queue.max_attempts THEN 'failed'
            WHEN enrichment_retry_queue.status = 'skipped' AND enrichment_retry_queue.reason = $5 THEN 'pending'
            WHEN enrichment_retry_queue.status = 'skipped' THEN 'skipped'
            ELSE 'pending'
          END,
          reason = CASE
            WHEN enrichment_retry_queue.reason = $5 THEN enrichment_retry_queue.reason
            ELSE EXCLUDED.reason
          END,
          priority = LEAST(enrichment_retry_queue.priority, EXCLUDED.priority),
          attempts = CASE
            WHEN enrichment_retry_queue.reason = $5 THEN 0
            ELSE enrichment_retry_queue.attempts
          END,
          completed_at = CASE
            WHEN enrichment_retry_queue.status IN ('completed', 'failed', 'skipped') THEN enrichment_retry_queue.completed_at
            ELSE NULL
          END
      `, [mediaItemId, enrichmentType, reason, priority, TAVILY_MONTHLY_DEFERRED_REASON]);

            logger.debug('Queued item for enrichment retry', { mediaItemId, enrichmentType, reason });

            this.scheduleProcessing();
        } catch (error) {
            if (error.code === '23503') {
                logger.warn('Skipping retry queue for deleted item', { mediaItemId });
                return;
            }
            logger.error('Failed to queue item for retry', { error: error.message, mediaItemId });
        }
    }

    /**
     * Schedule processing if not already scheduled
     * Debounced to avoid scheduling multiple times
     */
    scheduleProcessing() {
        if (this.processingScheduled || this.processingInProgress) {
            return;
        }

        this.processingScheduled = true;
        this.scheduledTimeout = setTimeout(() => {
            this.processingScheduled = false;
            this.scheduledTimeout = null;
            this.triggerProcessing();
        }, 5000);
    }

    /**
     * Cancel any scheduled processing (for cleanup)
     */
    cancelScheduledProcessing() {
        if (this.scheduledTimeout) {
            clearTimeout(this.scheduledTimeout);
            this.scheduledTimeout = null;
            this.processingScheduled = false;
        }
    }

    /**
     * Trigger processing (called by scheduler or on-demand)
     * Only processes OMDb - Tavily is NOT auto-retried (has monthly credits)
     */
    async triggerProcessing() {
        if (this.processingInProgress) {
            logger.debug('Enrichment processing already in progress, skipping');
            return;
        }

        this.processingInProgress = true;
        try {
            const initialStats = await this.getStats();
            const pendingOmdb = initialStats.omdb?.pending || 0;
            const pendingTavily = initialStats.tavily?.pending || 0;

            if (pendingOmdb > 0) {
                const omdbService = require('./omdb');
                const quota = await omdbService.hasRemainingQuota();

                if (!quota.available) {
                    logger.info('Enrichment retry queue: OMDb daily limit reached, pausing until next day', {
                        used: quota.used,
                        limit: quota.limit,
                        reason: quota.reason
                    });
                } else {
                    const remainingQuota = quota.limit - quota.used;
                    const toProcess = Math.min(pendingOmdb, remainingQuota);

                    logger.info(`Enrichment retry queue: Processing ${toProcess} OMDb items (${pendingOmdb} pending, ${remainingQuota} quota remaining)`);

                    const omdbResult = await this.processRetryQueue(toProcess, 'omdb');
                    logger.info('Enrichment retry queue: OMDb processed', {
                        processed: omdbResult.processed,
                        success: omdbResult.success,
                        failed: omdbResult.failed
                    });

                    const updatedStats = await this.getStats();
                    const remainingOmdb = updatedStats.omdb?.pending || 0;
                    if (remainingOmdb > 0) {
                        logger.info(`Enrichment retry queue: ${remainingOmdb} OMDb items remaining, will retry in 6 hours or when quota resets`);
                    }
                }
            } else {
                logger.debug('Enrichment retry queue: No pending OMDb items');
            }

            if (pendingTavily > 0) {
                const tavilyBatchLimit = 50;
                logger.info(`Enrichment retry queue: Processing up to ${tavilyBatchLimit} Tavily items (${pendingTavily} pending)`);
                const tavilyResult = await this.processRetryQueue(tavilyBatchLimit, 'tavily');
                logger.info('Enrichment retry queue: Tavily processed', {
                    processed: tavilyResult.processed,
                    success: tavilyResult.success,
                    failed: tavilyResult.failed
                });
            }
        } catch (error) {
            logger.error('Error processing enrichment retry queue', {
                error: error.message,
                stack: error.stack
            });
        } finally {
            this.processingInProgress = false;
        }
    }

    /**
     * Mark exhausted pending retries as failed so they don't remain stuck forever.
     * @param {string|null} enrichmentType - Optional enrichment type scope
     * @returns {number} number of rows updated
     */
    async failExhaustedPendingRetries(enrichmentType = null) {
        const hasTypeFilter = typeof enrichmentType === 'string' && enrichmentType.trim().length > 0;
        const params = [TAVILY_MONTHLY_DEFERRED_REASON];
        const typeClause = hasTypeFilter ? 'AND enrichment_type = $2' : '';
        if (hasTypeFilter) {
            params.push(enrichmentType);
        }

        const result = await db.query(`
      UPDATE enrichment_retry_queue
      SET status = 'failed',
          completed_at = NOW(),
          error_message = COALESCE(error_message, 'Max attempts reached while pending')
      WHERE status = 'pending'
        AND attempts >= max_attempts
        AND NOT (enrichment_type = 'tavily' AND reason = $1)
        ${typeClause}
    `, params);

        if (result.rowCount > 0) {
            logger.info('Auto-healed exhausted pending enrichment retries', {
                enrichmentType: hasTypeFilter ? enrichmentType : 'all',
                updated: result.rowCount
            });
        }

        return result.rowCount || 0;
    }

    /**
     * Convert legacy Tavily monthly-quota rows into pending deferred rows so
     * they are never terminally failed before quota reset.
     * @returns {number} number of rows normalized
     */
    async normalizeTavilyMonthlyDeferredRows() {
        const result = await db.query(`
      UPDATE enrichment_retry_queue
      SET status = 'pending',
          reason = $1,
          attempts = 0,
          completed_at = NULL,
          error_message = $2
      WHERE enrichment_type = 'tavily'
        AND (
          (status IN ('failed', 'skipped') AND (
            reason = $1
            OR error_message ILIKE '%status code 432%'
            OR error_message ILIKE '%monthly quota%'
            OR error_message ILIKE '%quota reached%'
          ))
          OR (status = 'pending' AND attempts >= max_attempts AND (
            reason = $1
            OR error_message ILIKE '%status code 432%'
            OR error_message ILIKE '%monthly quota%'
            OR error_message ILIKE '%quota reached%'
          ))
        )
    `, [TAVILY_MONTHLY_DEFERRED_REASON, TAVILY_MONTHLY_DEFERRED_MESSAGE]);

        if (result.rowCount > 0) {
            logger.info('Normalized Tavily monthly quota rows back to pending', {
                normalized: result.rowCount
            });
        }

        return result.rowCount || 0;
    }

    /**
     * Get retry queue statistics
     */
    async getStats() {
        await this.normalizeTavilyMonthlyDeferredRows();
        await this.failExhaustedPendingRetries();

        const result = await db.query(`
      SELECT 
        enrichment_type,
        status,
        COUNT(*) as count
      FROM enrichment_retry_queue
      GROUP BY enrichment_type, status
      ORDER BY enrichment_type, status
    `);

        const stats = {
            tavily: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 },
            omdb: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 },
            tmdb: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 },
            total: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 }
        };

        for (const row of result.rows) {
            const type = row.enrichment_type || 'tavily';
            const status = row.status || 'pending';
            const count = parseInt(row.count) || 0;

            if (stats[type]) {
                stats[type][status] = count;
            }
            stats.total[status] = (stats.total[status] || 0) + count;
        }

        return stats;
    }

    /**
     * Process pending items in the retry queue
     * @param {number} limit - Max items to process
     * @param {string} enrichmentType - Type to process ('tavily', 'omdb', etc.)
     */
    async processRetryQueue(limit = 50, enrichmentType = 'tavily') {
        await this.normalizeTavilyMonthlyDeferredRows();
        const autoFailed = await this.failExhaustedPendingRetries(enrichmentType);

        if (enrichmentType === 'tavily') {
            const tavilyConfig = await db.query(
                `SELECT api_key, is_active FROM tavily_config WHERE is_active = true LIMIT 1`
            );

            if (tavilyConfig.rows.length === 0) {
                logger.warn('Tavily not configured or inactive, skipping retry processing');
                return { processed: 0, success: 0, failed: 0, autoFailed, skipped: true, reason: 'Tavily not configured' };
            }

            await this.normalizeTavilyMonthlyDeferredRows();
        }

        const processLimit = limit;

        // Get pending items
        const pendingResult = await db.query(`
      SELECT 
        erq.id as queue_id,
        erq.media_item_id,
        erq.attempts,
        erq.max_attempts,
        msi.title,
        msi.year,
        msi.tmdb_id,
        msi.imdb_id,
        msi.media_type
      FROM enrichment_retry_queue erq
      JOIN media_server_items msi ON erq.media_item_id = msi.id
      WHERE erq.status = 'pending' 
        AND erq.enrichment_type = $1
        AND erq.attempts < erq.max_attempts
        AND (
          erq.enrichment_type <> 'tavily'
          OR erq.reason IS DISTINCT FROM $3
          OR date_trunc('month', COALESCE(erq.last_attempt_at, erq.created_at)) < date_trunc('month', NOW())
        )
      ORDER BY erq.priority ASC, erq.created_at ASC
      LIMIT $2
    `, [enrichmentType, processLimit, TAVILY_MONTHLY_DEFERRED_REASON]);

        if (pendingResult.rows.length === 0) {
            logger.info('No pending items in retry queue', { enrichmentType });
            return { processed: 0, success: 0, failed: 0, autoFailed, skipped: false };
        }

        let processed = 0;
        let success = 0;
        let failed = 0;

        for (const item of pendingResult.rows) {
            try {
                await db.query(
                    `UPDATE enrichment_retry_queue SET status = 'processing', last_attempt_at = NOW() WHERE id = $1`,
                    [item.queue_id]
                );

                let result;
                if (enrichmentType === 'omdb') {
                    result = await this.enrichWithOmdb(item);
                } else {
                    const tavilyConfig = await db.query(
                        `SELECT api_key FROM tavily_config WHERE is_active = true LIMIT 1`
                    );
                    if (tavilyConfig.rows.length === 0) {
                        await db.query(
                            `UPDATE enrichment_retry_queue SET status = 'pending', error_message = 'Tavily not configured' WHERE id = $1`,
                            [item.queue_id]
                        );
                        continue;
                    }
                    result = await this.enrichWithTavily(item, tavilyConfig.rows[0].api_key);
                }

                if (result.success) {
                    // Update queue status
                    await db.query(
                        `UPDATE enrichment_retry_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
                        [item.queue_id]
                    );

                    // Update media item enrichment status
                    await db.query(
                        `UPDATE media_server_items SET enrichment_status = 'completed' WHERE id = $1`,
                        [item.media_item_id]
                    );

                    success++;
                    logger.info('Tavily enrichment successful', { title: item.title, mediaItemId: item.media_item_id });
                } else if (result.deferUntilMonthlyReset) {
                    await db.query(
                        `UPDATE enrichment_retry_queue
             SET status = 'pending',
                 reason = $2,
                 attempts = 0,
                 completed_at = NULL,
                 error_message = $3
             WHERE id = $1`,
                        [item.queue_id, TAVILY_MONTHLY_DEFERRED_REASON, TAVILY_MONTHLY_DEFERRED_MESSAGE]
                    );
                    logger.info('Deferred Tavily retry item in pending until monthly quota reset', {
                        queueId: item.queue_id,
                        title: item.title
                    });
                } else {
                    const nextAttempts = (item.attempts || 0) + 1;
                    const exhausted = nextAttempts >= (item.max_attempts || 0);

                    // Increment attempts
                    await db.query(
                        `UPDATE enrichment_retry_queue 
             SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
                 attempts = attempts + 1,
                 error_message = $2
             WHERE id = $1`,
                        [item.queue_id, result.error || 'Unknown error']
                    );

                    if (exhausted) {
                        logger.error('Enrichment retry exhausted without required metadata', {
                            queueId: item.queue_id,
                            mediaItemId: item.media_item_id,
                            enrichmentType,
                            error: result.error || 'Unknown error'
                        });
                    } else {
                        logger.warn('Enrichment retry failed; item remains pending', {
                            queueId: item.queue_id,
                            mediaItemId: item.media_item_id,
                            enrichmentType,
                            attempts: nextAttempts,
                            maxAttempts: item.max_attempts,
                            error: result.error || 'Unknown error'
                        });
                    }
                    failed++;
                }

                processed++;
            } catch (error) {
                logger.error('Error processing retry queue item', { error: error.message, item });
                await db.query(
                    `UPDATE enrichment_retry_queue 
           SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
               attempts = attempts + 1,
               completed_at = CASE WHEN attempts + 1 >= max_attempts THEN NOW() ELSE completed_at END,
               error_message = $2 
           WHERE id = $1`,
                    [item.queue_id, error.message]
                );
                failed++;
                processed++;
            }
        }

        logger.info('Retry queue processing complete', { processed, success, failed, autoFailed, enrichmentType });
        return { processed, success, failed, autoFailed, skipped: false };
    }

    /**
     * Enrich a media item using Tavily
     * @param {object} item - Item details from retry queue
     * @param {string} apiKey - Tavily API key
     */
    async enrichWithTavily(item, apiKey) {
        try {
            const searchQuery = item.imdb_id
                ? `IMDb ${item.imdb_id}`
                : `${item.title} ${item.year || ''} IMDb rating`;

            const searchResult = await tavilyService.search(searchQuery, {
                apiKey,
                searchDepth: 'basic',
                maxResults: 3
            });

            const results = searchResult?.results || [];
            if (!results || results.length === 0) {
                return { success: false, error: 'No results found' };
            }

            const imdbData = this.extractImdbData(results, item.title);

            if (imdbData) {
                await db.query(`
          UPDATE media_server_items 
          SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{tavily_imdb}',
            $2::jsonb
          )
          WHERE id = $1
        `, [item.media_item_id, JSON.stringify(imdbData)]);

                return { success: true, data: imdbData };
            }

            return { success: false, error: 'Could not extract IMDb data' };
        } catch (error) {
            if (error.status === 432) {
                logger.info('Tavily monthly quota reached during enrichment retry; deferring item', {
                    status: error.status,
                    item: item.title
                });
                return {
                    success: false,
                    error: error.message,
                    deferUntilMonthlyReset: true
                };
            }

            logger.error('Tavily enrichment failed', {
                status: error.status || null,
                error: error.message,
                item: item.title
            });
            return { success: false, error: error.message };
        }
    }

    async enrichWithOmdb(item) {
        try {
            const omdbService = require('./omdb');

            let omdbResult = null;
            if (item.imdb_id) {
                omdbResult = await omdbService.getByIMDBId(item.imdb_id);
            }
            if (!omdbResult && item.title) {
                omdbResult = await omdbService.getByTitle(item.title, item.year, item.media_type);
            }

            if (omdbResult) {
                const omdbData = {
                    data: omdbResult,
                    fetched_at: new Date().toISOString()
                };

                await db.query(`
                    UPDATE media_server_items 
                    SET metadata = jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{omdb}',
                        $2::jsonb
                    )
                    WHERE id = $1
                `, [item.media_item_id, JSON.stringify(omdbData)]);

                logger.info('OMDb enrichment successful', { title: item.title, mediaItemId: item.media_item_id });
                return { success: true, data: omdbResult };
            }

            return { success: false, error: 'OMDb not found' };
        } catch (error) {
            logger.error('OMDb enrichment failed', { error: error.message, item: item.title });
            return { success: false, error: error.message };
        }
    }

    /**
     * Extract IMDb data from Tavily search results
     * @param {Array} results - Tavily search results
     * @param {string} title - Expected title for matching
     */
    extractImdbData(results, title) {
        for (const result of results) {
            const content = result.content || result.snippet || '';
            const url = result.url || '';

            // Look for IMDb URL
            const imdbMatch = url.match(/imdb\.com\/title\/(tt\d+)/i);

            if (imdbMatch) {
                const data = {
                    imdb_id: imdbMatch[1],
                    source: 'tavily',
                    url: url,
                    fetched_at: new Date().toISOString()
                };

                // Try to extract rating
                const ratingMatch = content.match(/(\d+\.?\d*)\/10/);
                if (ratingMatch) {
                    data.rating = parseFloat(ratingMatch[1]);
                }

                // Try to extract genre
                const genrePatterns = [
                    /\b(Action|Adventure|Animation|Biography|Comedy|Crime|Documentary|Drama|Family|Fantasy|History|Horror|Music|Musical|Mystery|Romance|Sci-Fi|Sport|Thriller|War|Western)\b/gi
                ];
                const genres = [];
                for (const pattern of genrePatterns) {
                    const matches = content.match(pattern);
                    if (matches) {
                        genres.push(...matches.map(g => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase()));
                    }
                }
                if (genres.length > 0) {
                    data.genres = [...new Set(genres)];
                }

                return data;
            }
        }

        return null;
    }

    /**
     * Backfill retry queue with items missing OMDb data
     */
    async backfillRetryQueue() {
        const result = await db.query(`
      INSERT INTO enrichment_retry_queue (media_item_id, enrichment_type, reason, priority)
      SELECT 
        msi.id,
        'tavily',
        'OMDb not found - backfill',
        5
      FROM media_server_items msi
      WHERE msi.metadata->'omdb' IS NULL
        AND msi.metadata->'content_analysis' IS NOT NULL
      ON CONFLICT (media_item_id, enrichment_type) DO NOTHING
      RETURNING id
    `);

        logger.info('Backfilled retry queue', { itemsQueued: result.rowCount });
        return { queued: result.rowCount };
    }
}

module.exports = new EnrichmentRetryService();
