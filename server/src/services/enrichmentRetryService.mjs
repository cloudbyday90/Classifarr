import * as dbModule from '../config/database.mjs';
import { tavilyService as tavilyModule } from './tavily.mjs';
import { omdbService as omdbModule } from './omdb.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
    TAVILY_MONTHLY_DEFERRED_REASON,
    TAVILY_MONTHLY_DEFERRED_MESSAGE
} from '../utils/enrichmentState.mjs';
import { EnrichmentItemStateService } from './enrichmentItemStateService.mjs';
import {
    enrichWithOmdb as _enrichWithOmdb,
    handleOmdbFallback as _handleOmdbFallback,
    isTransientOmdbTransportError as _isTransientOmdbTransportError,
    isExpectedOmdbMiss as _isExpectedOmdbMiss,
    buildOmdbFallbackReason as _buildOmdbFallbackReason
} from './enrichmentRetryOmdb.mjs';
import {
    enrichWithTavily as _enrichWithTavily,
    extractImdbData as _extractImdbData
} from './enrichmentRetryTavily.mjs';
import {
    recoverStaleProcessingRetries as _recoverStaleProcessingRetries,
    failExhaustedPendingRetries as _failExhaustedPendingRetries,
    resolveRetriesWithExistingMetadata as _resolveRetriesWithExistingMetadata,
    normalizeTavilyMonthlyDeferredRows as _normalizeTavilyMonthlyDeferredRows,
    countTavilyMonthlyDeferredRows as _countTavilyMonthlyDeferredRows
} from './enrichmentRetryMaintenance.mjs';

export const OMDB_FALLBACK_REASON = 'omdb_exhausted_fallback_to_tavily';
export const ENRICHMENT_RETRY_STALE_MS = Number.parseInt(process.env.ENRICHMENT_RETRY_STALE_MS || '', 10) || (20 * 60 * 1000);

export class EnrichmentRetryService {
    constructor(deps = {}) {
        this._db = deps.db || null;
        this._tavilyService = deps.tavilyService || null;
        this._omdbService = deps.omdbService || null;
        this._logger = deps.logger || null;
        this._enrichmentItemStateService = deps.enrichmentItemStateService || null;

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

    get enrichmentItemStateService() {
        if (!this._enrichmentItemStateService) {
            this._enrichmentItemStateService = new EnrichmentItemStateService({
                db: this.db,
                logger: this.logger
            });
        }
        return this._enrichmentItemStateService;
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
            await this.enrichmentItemStateService.syncItemState(mediaItemId);

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
        return _recoverStaleProcessingRetries({ db: this.db, enrichmentItemStateService: this.enrichmentItemStateService, logger: this.logger }, enrichmentType);
    }

    async failExhaustedPendingRetries(enrichmentType = null) {
        return _failExhaustedPendingRetries({ db: this.db, enrichmentItemStateService: this.enrichmentItemStateService, logger: this.logger }, enrichmentType);
    }

    async resolveRetriesWithExistingMetadata(enrichmentType = null) {
        return _resolveRetriesWithExistingMetadata({ db: this.db, enrichmentItemStateService: this.enrichmentItemStateService, logger: this.logger }, enrichmentType);
    }

    async normalizeTavilyMonthlyDeferredRows() {
        return _normalizeTavilyMonthlyDeferredRows({ db: this.db, enrichmentItemStateService: this.enrichmentItemStateService, logger: this.logger });
    }

    async countTavilyMonthlyDeferredRows() {
        return _countTavilyMonthlyDeferredRows({ db: this.db });
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
            tavily: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, deferred: 0, actionablePending: 0 },
            omdb: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, deferred: 0, actionablePending: 0 },
            tmdb: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, deferred: 0, actionablePending: 0 },
            total: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, deferred: 0, actionablePending: 0 }
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

        const tavilyDeferredCount = await this.countTavilyMonthlyDeferredRows();
        stats.tavily.deferred = tavilyDeferredCount;
        stats.total.deferred = tavilyDeferredCount;
        stats.tavily.actionablePending = Math.max(0, stats.tavily.pending - tavilyDeferredCount);
        stats.omdb.actionablePending = stats.omdb.pending;
        stats.tmdb.actionablePending = stats.tmdb.pending;
        stats.total.actionablePending = Math.max(0, stats.total.pending - tavilyDeferredCount);

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
                    await this.enrichmentItemStateService.syncItemState(item.media_item_id);

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
                    await this.enrichmentItemStateService.syncItemState(item.media_item_id);
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
                    await this.enrichmentItemStateService.syncItemState(item.media_item_id);

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
                await this.enrichmentItemStateService.syncItemState(item.media_item_id);
                failed++;
                processed++;
            }
        }

        this.logger.info('Retry queue processing complete', { processed, success, failed, autoFailed, enrichmentType });
        return { processed, success, failed, autoFailed, skipped: false };
    }

    async handleOmdbFallback(item, resultError, options = {}) {
        return _handleOmdbFallback(
            { db: this.db, logger: this.logger, enrichmentItemStateService: this.enrichmentItemStateService, queueForRetry: (...args) => this.queueForRetry(...args) },
            item, resultError, options
        );
    }

    buildOmdbFallbackReason(resultError) {
        return _buildOmdbFallbackReason(resultError);
    }

    isExpectedOmdbMiss(errorMessage) {
        return _isExpectedOmdbMiss(errorMessage);
    }

    isTransientOmdbTransportError(error) {
        return _isTransientOmdbTransportError(error);
    }

    async enrichWithTavily(item, apiKey) {
        return _enrichWithTavily({ db: this.db, tavilyService: this.tavilyService, logger: this.logger }, item, apiKey);
    }

    async enrichWithOmdb(item) {
        return _enrichWithOmdb({ db: this.db, omdbService: this.omdbService, logger: this.logger }, item);
    }

    extractImdbData(results, title) {
        return _extractImdbData(results, title);
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
      RETURNING id, media_item_id
    `);

        this.logger.info('Backfilled retry queue', { itemsQueued: result.rowCount });
        const queuedIds = (Array.isArray(result.rows) ? result.rows : []).map((row) => row.media_item_id).filter(Boolean);
        if (queuedIds.length > 0) {
            await this.enrichmentItemStateService.syncItemStates(queuedIds);
        }
        return {
            success: true,
            queued: result.rowCount,
            enrichmentType: 'tavily',
            reason: 'items_missing_omdb_data',
        };
    }
}

export const enrichmentRetryService = new EnrichmentRetryService();
