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
import { getStats as _getStats } from './enrichmentRetryStats.mjs';
import { processRetryQueue as _processRetryQueue } from './enrichmentRetryProcessing.mjs';

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
        return _getStats({
            db: this.db,
            normalizeTavilyMonthlyDeferredRows: () => this.normalizeTavilyMonthlyDeferredRows(),
            resolveRetriesWithExistingMetadata: (...args) => this.resolveRetriesWithExistingMetadata(...args),
            failExhaustedPendingRetries: (...args) => this.failExhaustedPendingRetries(...args),
            countTavilyMonthlyDeferredRows: () => this.countTavilyMonthlyDeferredRows()
        });
    }

    async processRetryQueue(limit = 50, enrichmentType = 'tavily') {
        return _processRetryQueue({
            db: this.db,
            logger: this.logger,
            enrichmentItemStateService: this.enrichmentItemStateService,
            recoverStaleProcessingRetries: (...args) => this.recoverStaleProcessingRetries(...args),
            normalizeTavilyMonthlyDeferredRows: () => this.normalizeTavilyMonthlyDeferredRows(),
            resolveRetriesWithExistingMetadata: (...args) => this.resolveRetriesWithExistingMetadata(...args),
            failExhaustedPendingRetries: (...args) => this.failExhaustedPendingRetries(...args),
            enrichWithOmdb: (...args) => this.enrichWithOmdb(...args),
            enrichWithTavily: (...args) => this.enrichWithTavily(...args),
            handleOmdbFallback: (...args) => this.handleOmdbFallback(...args),
            isExpectedOmdbMiss: (...args) => this.isExpectedOmdbMiss(...args)
        }, limit, enrichmentType);
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
