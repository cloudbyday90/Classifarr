/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as dbModule from '../config/database.mjs';
import { tavilyService as tavilyModule } from './tavily.mjs';
import { omdbService as omdbModule } from './omdb.mjs';
import { createLogger } from '../utils/logger.mjs';

export const TAVILY_MONTHLY_DEFERRED_REASON = 'tavily_monthly_quota_deferred';
export const TAVILY_MONTHLY_DEFERRED_MESSAGE = 'Tavily monthly quota reached; deferred until next month reset';
export const OMDB_FALLBACK_REASON = 'omdb_exhausted_fallback_to_tavily';
export const ENRICHMENT_RETRY_STALE_MS = Number.parseInt(process.env.ENRICHMENT_RETRY_STALE_MS || '', 10) || (20 * 60 * 1000);

export class EnrichmentRetryService {
    constructor(deps = {}) {
        this._db = deps.db || null;
        this._tavilyService = deps.tavilyService || null;
        this._omdbService = deps.omdbService || null;
        this._logger = deps.logger || null;

        this.processingScheduled = false;
        this.processingInProgress = false;
        this.scheduledTimeout = null;
    }

    get db() {
        if (!this._db) {
            this._db = dbModule;
        }
        return this._db;
    }

    get tavilyService() {
        if (!this._tavilyService) {
            this._tavilyService = tavilyModule;
        }
        return this._tavilyService;
    }

    get omdbService() {
        if (!this._omdbService) {
            this._omdbService = omdbModule;
        }
        return this._omdbService;
    }

    get logger() {
        if (!this._logger) {
            this._logger = createLogger('EnrichmentRetryService');
        }
        return this._logger;
    }

    async queueForRetry(mediaItemId, enrichmentType = 'tavily', reason = 'OMDb not found', priority = 5) {
        try {
            await this.db.query(`
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

            this.logger.debug('Queued item for enrichment retry', { mediaItemId, enrichmentType, reason });

            this.scheduleProcessing();
        } catch (error) {
            if (error.code === '23503') {
                this.logger.warn('Skipping retry queue for deleted item', { mediaItemId });
                return;
            }
            this.logger.error('Failed to queue item for retry', { error: error.message, mediaItemId });
        }
    }

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

    cancelScheduledProcessing() {
        if (this.scheduledTimeout) {
            clearTimeout(this.scheduledTimeout);
            this.scheduledTimeout = null;
            this.processingScheduled = false;
        }
    }

    resetState() {
        this.cancelScheduledProcessing();
        this.processingScheduled = false;
        this.processingInProgress = false;
    }

    async triggerProcessing() {
        if (this.processingInProgress) {
            this.logger.debug('Enrichment processing already in progress, skipping');
            return;
        }

        this.processingInProgress = true;
        try {
            await this.recoverStaleProcessingRetries();

            const initialStats = await this.getStats();
            const pendingOmdb = initialStats.omdb?.pending || 0;
            const pendingTavily = initialStats.tavily?.pending || 0;

            if (pendingOmdb > 0) {
                const quota = await this.omdbService.hasRemainingQuota();

                if (!quota.available) {
                    this.logger.info('Enrichment retry queue: OMDb daily limit reached, pausing until next day', {
                        used: quota.used,
                        limit: quota.limit,
                        reason: quota.reason
                    });
                } else {
                    const remainingQuota = quota.limit - quota.used;
                    const toProcess = Math.min(pendingOmdb, remainingQuota);

                    this.logger.info(`Enrichment retry queue: Processing ${toProcess} OMDb items (${pendingOmdb} pending, ${remainingQuota} quota remaining)`);

                    const omdbResult = await this.processRetryQueue(toProcess, 'omdb');
                    this.logger.info('Enrichment retry queue: OMDb processed', {
                        processed: omdbResult.processed,
                        success: omdbResult.success,
                        failed: omdbResult.failed
                    });

                    const updatedStats = await this.getStats();
                    const remainingOmdb = updatedStats.omdb?.pending || 0;
                    if (remainingOmdb > 0) {
                        this.logger.info(`Enrichment retry queue: ${remainingOmdb} OMDb items remaining, will retry in 6 hours or when quota resets`);
                    }
                }
            } else {
                this.logger.debug('Enrichment retry queue: No pending OMDb items');
            }

            if (pendingTavily > 0) {
                const tavilyConfig = await this.db.query(
                    `SELECT api_key, is_active FROM tavily_config WHERE is_active = true LIMIT 1`
                );

                if (tavilyConfig.rows.length === 0) {
                    this.logger.debug(`Enrichment retry queue: ${pendingTavily} Tavily items pending but Tavily not configured, skipping`);
                } else {
                    const tavilyBatchLimit = 50;
                    this.logger.info(`Enrichment retry queue: Processing up to ${tavilyBatchLimit} Tavily items (${pendingTavily} pending)`);
                    const tavilyResult = await this.processRetryQueue(tavilyBatchLimit, 'tavily');
                    this.logger.info('Enrichment retry queue: Tavily processed', {
                        processed: tavilyResult.processed,
                        success: tavilyResult.success,
                        failed: tavilyResult.failed
                    });
                }
            }
        } catch (error) {
            this.logger.error('Error processing enrichment retry queue', {
                error: error.message,
                stack: error.stack
            });
        } finally {
            this.processingInProgress = false;
        }
    }

    async recoverStaleProcessingRetries(enrichmentType = null) {
        const hasTypeFilter = typeof enrichmentType === 'string' && enrichmentType.trim().length > 0;
        const typeClause = hasTypeFilter ? 'AND enrichment_type = $2' : '';
        const params = [ENRICHMENT_RETRY_STALE_MS];
        if (hasTypeFilter) {
            params.push(enrichmentType);
        }

        const result = await this.db.query(`
      UPDATE enrichment_retry_queue
      SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
          attempts = LEAST(attempts + 1, max_attempts),
          completed_at = CASE WHEN attempts + 1 >= max_attempts THEN NOW() ELSE NULL END,
          error_message = COALESCE(error_message, 'Recovered stale processing retry'),
          last_attempt_at = NOW()
      WHERE status = 'processing'
        AND COALESCE(last_attempt_at, created_at) < NOW() - ($1 * INTERVAL '1 millisecond')
        ${typeClause}
      RETURNING id, media_item_id, enrichment_type
    `, params);

        if (result.rowCount > 0) {
            this.logger.warn('Recovered stale enrichment retry rows', {
                count: result.rowCount,
                enrichmentType: hasTypeFilter ? enrichmentType : 'all',
                thresholdMs: ENRICHMENT_RETRY_STALE_MS,
                queueIds: result.rows.slice(0, 20).map(row => row.id)
            });
        }

        return result.rowCount || 0;
    }

    async failExhaustedPendingRetries(enrichmentType = null) {
        const hasTypeFilter = typeof enrichmentType === 'string' && enrichmentType.trim().length > 0;
        const params = [TAVILY_MONTHLY_DEFERRED_REASON];
        const typeClause = hasTypeFilter ? 'AND enrichment_type = $2' : '';
        if (hasTypeFilter) {
            params.push(enrichmentType);
        }

        const result = await this.db.query(`
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
            this.logger.info('Auto-healed exhausted pending enrichment retries', {
                enrichmentType: hasTypeFilter ? enrichmentType : 'all',
                updated: result.rowCount
            });
        }

        return result.rowCount || 0;
    }

    async resolveRetriesWithExistingMetadata(enrichmentType = null) {
        const hasTypeFilter = typeof enrichmentType === 'string' && enrichmentType.trim().length > 0;
        const params = [];
        const typeClause = hasTypeFilter ? 'AND erq.enrichment_type = $1' : '';

        if (hasTypeFilter) {
            params.push(enrichmentType);
        }

        const result = await this.db.query(`
      UPDATE enrichment_retry_queue erq
      SET status = 'completed',
          completed_at = COALESCE(erq.completed_at, NOW()),
          error_message = COALESCE(erq.error_message, 'Auto-resolved: required enrichment metadata already present')
      FROM media_server_items msi
      WHERE erq.media_item_id = msi.id
        AND erq.status IN ('pending', 'processing')
        ${typeClause}
        AND (
          (erq.enrichment_type = 'omdb' AND msi.metadata->'omdb' IS NOT NULL)
          OR (erq.enrichment_type = 'tavily' AND (
            msi.metadata->'tavily_imdb' IS NOT NULL
            OR msi.metadata->'tavily_advisory' IS NOT NULL
            OR msi.metadata->'omdb' IS NOT NULL
          ))
          OR (erq.enrichment_type = 'tmdb' AND msi.metadata->'tmdb' IS NOT NULL)
        )
      RETURNING erq.id, erq.media_item_id, erq.enrichment_type
    `, params);

        if (result.rowCount > 0) {
            this.logger.info('Auto-resolved stale enrichment retry rows', {
                enrichmentType: hasTypeFilter ? enrichmentType : 'all',
                resolved: result.rowCount
            });
        }

        return result.rowCount || 0;
    }

    async normalizeTavilyMonthlyDeferredRows() {
        const result = await this.db.query(`
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
            this.logger.info('Normalized Tavily monthly quota rows back to pending', {
                normalized: result.rowCount
            });
        }

        return result.rowCount || 0;
    }

    async getStats() {
        await this.normalizeTavilyMonthlyDeferredRows();
        await this.resolveRetriesWithExistingMetadata();
        await this.failExhaustedPendingRetries();

        const result = await this.db.query(`
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

    async processRetryQueue(limit = 50, enrichmentType = 'tavily') {
        await this.recoverStaleProcessingRetries(enrichmentType);
        await this.normalizeTavilyMonthlyDeferredRows();
        await this.resolveRetriesWithExistingMetadata(enrichmentType);
        const autoFailed = await this.failExhaustedPendingRetries(enrichmentType);

        if (enrichmentType === 'tavily') {
            const tavilyConfig = await this.db.query(
                `SELECT api_key, is_active FROM tavily_config WHERE is_active = true LIMIT 1`
            );

            if (tavilyConfig.rows.length === 0) {
                return { processed: 0, success: 0, failed: 0, autoFailed, skipped: true, reason: 'Tavily not configured' };
            }

            await this.normalizeTavilyMonthlyDeferredRows();
        }

        const processLimit = limit;

        const pendingResult = await this.db.query(`
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
          (erq.enrichment_type <> 'omdb' OR msi.metadata->'omdb' IS NULL)
          AND (erq.enrichment_type <> 'tavily' OR (
            msi.metadata->'tavily_imdb' IS NULL
            AND msi.metadata->'tavily_advisory' IS NULL
            AND msi.metadata->'omdb' IS NULL
          ))
          AND (erq.enrichment_type <> 'tmdb' OR msi.metadata->'tmdb' IS NULL)
        )
        AND (
          erq.enrichment_type <> 'tavily'
          OR erq.reason IS DISTINCT FROM $3
          OR date_trunc('month', COALESCE(erq.last_attempt_at, erq.created_at)) < date_trunc('month', NOW())
        )
      ORDER BY erq.priority ASC, erq.created_at ASC
      LIMIT $2
    `, [enrichmentType, processLimit, TAVILY_MONTHLY_DEFERRED_REASON]);

        if (pendingResult.rows.length === 0) {
            this.logger.info('No pending items in retry queue', { enrichmentType });
            return { processed: 0, success: 0, failed: 0, autoFailed, skipped: false };
        }

        let processed = 0;
        let success = 0;
        let failed = 0;

        for (const item of pendingResult.rows) {
            try {
                await this.db.query(
                    `UPDATE enrichment_retry_queue SET status = 'processing', last_attempt_at = NOW() WHERE id = $1`,
                    [item.queue_id]
                );

                let result;
                if (enrichmentType === 'omdb') {
                    result = await this.enrichWithOmdb(item);
                } else {
                    const tavilyConfig = await this.db.query(
                        `SELECT api_key FROM tavily_config WHERE is_active = true LIMIT 1`
                    );
                    if (tavilyConfig.rows.length === 0) {
                        await this.db.query(
                            `UPDATE enrichment_retry_queue SET status = 'pending', error_message = 'Tavily not configured' WHERE id = $1`,
                            [item.queue_id]
                        );
                        continue;
                    }
                    result = await this.enrichWithTavily(item, tavilyConfig.rows[0].api_key);
                }

                if (result.success) {
                    await this.db.query(
                        `UPDATE enrichment_retry_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
                        [item.queue_id]
                    );

                    await this.db.query(
                        `UPDATE media_server_items SET enrichment_status = 'completed' WHERE id = $1`,
                        [item.media_item_id]
                    );

                    success++;
                    this.logger.info('Tavily enrichment successful', { title: item.title, mediaItemId: item.media_item_id });
                } else if (result.deferUntilMonthlyReset) {
                    await this.db.query(
                        `UPDATE enrichment_retry_queue
             SET status = 'pending',
                 reason = $2,
                 attempts = 0,
                 completed_at = NULL,
                 error_message = $3
             WHERE id = $1`,
                        [item.queue_id, TAVILY_MONTHLY_DEFERRED_REASON, TAVILY_MONTHLY_DEFERRED_MESSAGE]
                    );
                    this.logger.info('Deferred Tavily retry item in pending until monthly quota reset', {
                        queueId: item.queue_id,
                        title: item.title
                    });
                } else {
                    const nextAttempts = (item.attempts || 0) + 1;
                    const exhausted = nextAttempts >= (item.max_attempts || 0);
                    const resultError = result.error || 'Unknown error';

                    if (enrichmentType === 'omdb' && this.isExpectedOmdbMiss(resultError)) {
                        const handledByFallback = await this.handleOmdbFallback(item, resultError, { exhausted: false });
                        if (handledByFallback) {
                            processed++;
                            continue;
                        }
                    }

                    if (enrichmentType === 'omdb' && exhausted) {
                        const handledByFallback = await this.handleOmdbFallback(item, resultError, { exhausted: true });
                        if (handledByFallback) {
                            processed++;
                            continue;
                        }
                    }

                    await this.db.query(
                        `UPDATE enrichment_retry_queue 
             SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
                 attempts = attempts + 1,
                 error_message = $2
             WHERE id = $1`,
                        [item.queue_id, resultError]
                    );

                    if (exhausted) {
                        this.logger.error('Enrichment retry exhausted without required metadata', {
                            queueId: item.queue_id,
                            mediaItemId: item.media_item_id,
                            enrichmentType,
                            error: resultError
                        });
                    } else {
                        this.logger.info('Enrichment retry failed; item remains pending', {
                            queueId: item.queue_id,
                            mediaItemId: item.media_item_id,
                            enrichmentType,
                            attempts: nextAttempts,
                            maxAttempts: item.max_attempts,
                            error: resultError
                        });
                    }
                    failed++;
                }

                processed++;
            } catch (error) {
                this.logger.error('Error processing retry queue item', { error: error.message, item });
                await this.db.query(
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

        this.logger.info('Retry queue processing complete', { processed, success, failed, autoFailed, enrichmentType });
        return { processed, success, failed, autoFailed, skipped: false };
    }

    async handleOmdbFallback(item, resultError, options = {}) {
        const { exhausted = false } = options;
        const fallbackReason = this.buildOmdbFallbackReason(resultError);

        await this.queueForRetry(item.media_item_id, 'tavily', fallbackReason, 5);

        const fallbackRowResult = await this.db.query(
            `SELECT id, status, reason
             FROM enrichment_retry_queue
             WHERE media_item_id = $1
               AND enrichment_type = 'tavily'
             LIMIT 1`,
            [item.media_item_id]
        );

        if (fallbackRowResult.rows.length === 0) {
            return false;
        }

        await this.db.query(
            `UPDATE enrichment_retry_queue
             SET status = 'skipped',
                 attempts = GREATEST(attempts + 1, max_attempts),
                 completed_at = NOW(),
                 error_message = $2,
                 reason = COALESCE(NULLIF(reason, ''), $3)
             WHERE id = $1`,
            [item.queue_id, resultError || 'OMDb not found', OMDB_FALLBACK_REASON]
        );

        const fallbackRow = fallbackRowResult.rows[0];
        const logPayload = {
            queueId: item.queue_id,
            mediaItemId: item.media_item_id,
            omdbError: resultError || 'OMDb not found',
            tavilyQueueId: fallbackRow.id,
            tavilyStatus: fallbackRow.status,
            tavilyReason: fallbackRow.reason || null
        };

        if (this.isExpectedOmdbMiss(resultError)) {
            this.logger.info(exhausted
                ? 'OMDb retry exhausted; item moved to Tavily fallback'
                : 'OMDb metadata miss; item moved to Tavily fallback', logPayload);
        } else {
            this.logger.warn('OMDb retry exhausted after operational errors; item moved to Tavily fallback', logPayload);
        }

        return true;
    }

    buildOmdbFallbackReason(resultError) {
        if (this.isExpectedOmdbMiss(resultError)) {
            return 'OMDb not found';
        }

        if (!resultError) {
            return 'OMDb retry exhausted';
        }

        return `OMDb retry exhausted: ${String(resultError).slice(0, 80)}`;
    }

    isExpectedOmdbMiss(errorMessage) {
        const normalized = String(errorMessage || '').toLowerCase();
        return normalized.includes('omdb not found') ||
            normalized.includes('movie not found') ||
            normalized.includes('series not found') ||
            normalized.includes('error getting data');
    }

    isTransientOmdbTransportError(error) {
        const code = String(error?.code || '').toUpperCase();
        const normalized = String(error?.message || '').toLowerCase();
        const status = error?.response?.status;

        const isTransientHttpStatus =
            status === 408 ||
            status === 429 ||
            status === 502 ||
            status === 503 ||
            status === 504 ||
            (status >= 520 && status <= 527) ||
            status === 530;

        return isTransientHttpStatus ||
            code === 'ECONNABORTED' ||
            code === 'ETIMEDOUT' ||
            code === 'ECONNRESET' ||
            code === 'ENOTFOUND' ||
            code === 'EAI_AGAIN' ||
            normalized.includes('timeout') ||
            normalized.includes('socket hang up') ||
            normalized.includes('cloudflare');
    }

    async enrichWithTavily(item, apiKey) {
        try {
            const searchQuery = item.imdb_id
                ? `IMDb ${item.imdb_id}`
                : `${item.title} ${item.year || ''} IMDb rating`;

            const searchResult = await this.tavilyService.search(searchQuery, {
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
                await this.db.query(`
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
                this.logger.info('Tavily monthly quota reached during enrichment retry; deferring item', {
                    status: error.status,
                    item: item.title
                });
                return {
                    success: false,
                    error: error.message,
                    deferUntilMonthlyReset: true
                };
            }

            this.logger.error('Tavily enrichment failed', {
                status: error.status || null,
                error: error.message,
                item: item.title
            });
            return { success: false, error: error.message };
        }
    }

    async enrichWithOmdb(item) {
        try {
            let omdbResult = null;
            if (item.imdb_id) {
                omdbResult = await this.omdbService.getByIMDBId(item.imdb_id);
            }
            if (!omdbResult && item.title) {
                omdbResult = await this.omdbService.getByTitle(item.title, item.year, item.media_type);
            }

            if (omdbResult) {
                const omdbData = {
                    data: omdbResult,
                    fetched_at: new Date().toISOString()
                };

                await this.db.query(`
                    UPDATE media_server_items 
                    SET metadata = jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{omdb}',
                        $2::jsonb
                    )
                    WHERE id = $1
                `, [item.media_item_id, JSON.stringify(omdbData)]);

                this.logger.info('OMDb enrichment successful', { title: item.title, mediaItemId: item.media_item_id });
                return { success: true, data: omdbResult };
            }

            return { success: false, error: 'OMDb not found' };
        } catch (error) {
            if (this.isTransientOmdbTransportError(error)) {
                this.logger.warn('OMDb enrichment transient error', {
                    item: item.title,
                    error: error.message,
                    code: error.code || null
                });
            } else {
                this.logger.error('OMDb enrichment failed', { error: error.message, item: item.title });
            }
            return { success: false, error: error.message };
        }
    }

    extractImdbData(results, _title) {
        for (const result of results) {
            const content = result.content || result.snippet || '';
            const url = result.url || '';

            const imdbMatch = url.match(/imdb\.com\/title\/(tt\d+)/i);

            if (imdbMatch) {
                const data = {
                    imdb_id: imdbMatch[1],
                    source: 'tavily',
                    url: url,
                    fetched_at: new Date().toISOString()
                };

                const ratingMatch = content.match(/(\d+\.?\d*)\/10/);
                if (ratingMatch) {
                    data.rating = parseFloat(ratingMatch[1]);
                }

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

    async backfillRetryQueue() {
        const result = await this.db.query(`
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

        this.logger.info('Backfilled retry queue', { itemsQueued: result.rowCount });
        return {
            success: true,
            queued: result.rowCount,
            enrichmentType: 'tavily',
            reason: 'items_missing_omdb_data',
        };
    }
}

export const enrichmentRetryService = new EnrichmentRetryService();
