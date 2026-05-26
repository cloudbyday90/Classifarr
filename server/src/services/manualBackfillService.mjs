import { ConflictError, NotFoundError, ValidationError } from '../utils/appError.mjs';
import * as db from '../config/database.mjs';
import { DB_ADVISORY_LOCKS } from '../config/database.mjs';
import { embeddingService } from './embeddingService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { isTextBackfillConfigured } from './idleBackfillConfig.mjs';
import {
    createInitialState as _createInitialState,
    tryAcquireSessionLock as _tryAcquireSessionLock,
    resolveBatchSize as _resolveBatchSize,
    buildProviderUnavailableMessage as _buildProviderUnavailableMessage,
    buildProviderBusyMessage as _buildProviderBusyMessage,
    syncTrackedTotal as _syncTrackedTotal,
    runBackfill as _runBackfill,
} from './manualBackfillRun.mjs';

const logger = createLogger('ManualBackfillService');

class ManualBackfillService {
    constructor() {
        this.state = this.createInitialState();
        this.isProcessing = false;
        this._lockClient = null;
        this._activeRunPromise = null;
    }

    createInitialState() {
        return _createInitialState();
    }

    async acquireLock() {
        if (this._lockClient) {
            return this._lockClient;
        }

        const lockClient = await db.pool.connect();
        let released = false;
        const acquiredLocks = [];
        try {
            await _tryAcquireSessionLock(
                lockClient,
                DB_ADVISORY_LOCKS.BACKFILL_OWNER,
                'Another backfill mode is already running'
            );
            acquiredLocks.push(DB_ADVISORY_LOCKS.BACKFILL_OWNER);
            await _tryAcquireSessionLock(
                lockClient,
                DB_ADVISORY_LOCKS.MANUAL_BACKFILL,
                'Backfill already running in another process'
            );
            acquiredLocks.push(DB_ADVISORY_LOCKS.MANUAL_BACKFILL);

            this._lockClient = lockClient;
            return lockClient;
        } catch (error) {
            if (!released && this._lockClient !== lockClient) {
                for (const lockKey of acquiredLocks.reverse()) {
                    await lockClient.query('SELECT pg_advisory_unlock($1)', [lockKey]).catch(() => {}); // swallow-error: best-effort advisory lock release in error-recovery path
                }
                lockClient.release();
            }
            logger.info('Manual backfill skipped: advisory lock held by another process', {
                error: error.message
            });
            throw error;
        }
    }

    async releaseLock(context = 'unlock advisory lock') {
        if (!this._lockClient) {
            return;
        }

        const lockClient = this._lockClient;
        this._lockClient = null;
        const lockKeys = [
            DB_ADVISORY_LOCKS.MANUAL_BACKFILL,
            DB_ADVISORY_LOCKS.BACKFILL_OWNER
        ];
        for (const lockKey of lockKeys) {
            await lockClient.query('SELECT pg_advisory_unlock($1)', [lockKey])
                .catch((unlockError) => logger.error(`Failed to ${context}`, { error: unlockError.message, lockKey }));
        }
        lockClient.release();
    }

    async getPendingCount(includeImage = null) {
        const resolvedIncludeImage = includeImage ?? await embeddingService.shouldIncludeImageEmbeddings();
        return await embeddingService.getPendingCount({ includeImage: resolvedIncludeImage });
    }

    async getPendingEmbeddings(limit, includeImage = null) {
        const resolvedIncludeImage = includeImage ?? await embeddingService.shouldIncludeImageEmbeddings();
        return await embeddingService.getPendingEmbeddings({
            limit,
            includeImage: resolvedIncludeImage
        });
    }

    resolveBatchSize(options = {}, configuredBatchSize = null) {
        return _resolveBatchSize(options, configuredBatchSize);
    }

    buildProviderUnavailableMessage(availability = {}) {
        return _buildProviderUnavailableMessage(availability);
    }

    buildProviderBusyMessage(error = {}) {
        return _buildProviderBusyMessage(error);
    }

    launchTrackedRun(errorLogMessage) {
        const runPromise = this.runBackfill()
            .catch(error => {
                logger.error(errorLogMessage, { error: error.message }, { error });
                this.state.error = error.message;
                this.state.status = 'failed';
            })
            .finally(() => {
                if (this._activeRunPromise === runPromise) {
                    this._activeRunPromise = null;
                }
            });

        this._activeRunPromise = runPromise;
        return runPromise;
    }

    async syncTrackedTotal(currentPending, options = {}) {
        return _syncTrackedTotal(this.state, currentPending, options);
    }

    async start(options = {}) {
        const configResult = await db.query(
            'SELECT rag_enabled, manual_backfill_batch_size FROM ai_provider_config WHERE id = 1'
        );
        if (configResult.rows.length === 0) {
            throw new NotFoundError('RAG configuration not found. Complete setup in Settings before running backfill.');
        }
        if (!configResult.rows[0].rag_enabled) {
            throw new ValidationError('RAG is not enabled. Please enable RAG in settings before running backfill.');
        }

        if (['running', 'paused', 'cancelling'].includes(this.state.status) || this._activeRunPromise) {
            throw new ConflictError('Backfill already running');
        }

        const availability = await embeddingService.getProviderAvailabilityStatus({ refresh: true });
        if (availability.status === 'cooldown' || availability.status === 'probing') {
            throw new Error(this.buildProviderUnavailableMessage(availability));
        }

        const textReady = isTextBackfillConfigured(configResult.rows[0]);
        const imageReady = await embeddingService.shouldIncludeImageEmbeddings();
        if (!textReady && !imageReady) {
            throw new Error('No embedding providers configured. Configure a text or image embedding provider in settings before running backfill.');
        }

        await this.acquireLock();

        try {
            this.state.batchSize = this.resolveBatchSize(options, configResult.rows[0].manual_backfill_batch_size);
            this.state.includeImage = await embeddingService.shouldIncludeImageEmbeddings();
            this.state.total = await this.getPendingCount(this.state.includeImage);
            this.state.processed = 0;
            this.state.startTime = Date.now();
            this.state.status = 'running';
            this.state.error = null;
            this.state.eta = null;

            logger.info('Manual backfill started', {
                total: this.state.total,
                batchSize: this.state.batchSize
            });

            const runResult = await db.query(`
                INSERT INTO backfill_runs (type, status, total)
                VALUES ('manual', 'running', $1)
                RETURNING id
            `, [this.state.total]);
            this.state.runId = runResult.rows[0].id;
        } catch (setupError) {
            await this.releaseLock('unlock advisory lock during setup error');
            throw setupError;
        }

        this.launchTrackedRun('Manual backfill error');

        return await this.getStatus();
    }

    async runBackfill() {
        if (this.isProcessing) {
            logger.warn('runBackfill() already in progress, skipping');
            return;
        }

        this.isProcessing = true;
        try {
            await _runBackfill(this.state, {
                releaseLock: (...args) => this.releaseLock(...args)
            });
        } finally {
            this.isProcessing = false;
        }
    }

    pause() {
        if (this.state.status === 'running') {
            this.state.status = 'paused';
            logger.info('Manual backfill paused', { processed: this.state.processed });

            if (this.state.runId) {
                db.query(
                    'UPDATE backfill_runs SET status = $1 WHERE id = $2',
                    ['paused', this.state.runId]
                ).catch(error => logger.error('Failed to update run status', { error: error.message }));
            }
        }
    }

    async resume() {
        if (this.state.status === 'paused') {
            const availability = await embeddingService.getProviderAvailabilityStatus({ refresh: true });
            if (availability.status === 'cooldown' || availability.status === 'probing') {
                throw new Error(this.buildProviderUnavailableMessage(availability));
            }

            await this.acquireLock();
            this.state.status = 'running';
            logger.info('Manual backfill resumed', { processed: this.state.processed });

            if (this.state.runId) {
                await db.query(
                    'UPDATE backfill_runs SET status = $1 WHERE id = $2',
                    ['running', this.state.runId]
                );
            }

            this.launchTrackedRun('Resume backfill error');
        }
    }

    async cancel() {
        if (this.state.status === 'running') {
            this.state.status = 'cancelling';
            logger.info('Manual backfill cancellation requested', { processed: this.state.processed });
            if (this._activeRunPromise) {
                await this._activeRunPromise;
            }
            return;
        }

        if (this.state.status === 'paused') {
            if (this._activeRunPromise) {
                await this._activeRunPromise;
            }
            if (this.state.runId) {
                await db.query(`
                    UPDATE backfill_runs
                    SET status = 'cancelled',
                        completed_at = NOW(),
                        processed = $1,
                        error = $2
                    WHERE id = $3
                `, [this.state.processed, this.state.error, this.state.runId]);
            }
            await this.releaseLock('unlock advisory lock during cancellation');
        }
    }

    async clear() {
        if (['running', 'paused', 'cancelling'].includes(this.state.status)) {
            await this.cancel();
        }

        this.state = this.createInitialState();
        this.isProcessing = false;
        logger.info('Manual backfill state cleared');
    }

    async getStatus() {
        const includeImage = this.state.status === 'running' || this.state.status === 'paused'
            ? this.state.includeImage
            : await embeddingService.shouldIncludeImageEmbeddings();
        const currentPending = await this.getPendingCount(includeImage);

        await this.syncTrackedTotal(currentPending, {
            persist: ['running', 'paused', 'cancelling'].includes(this.state.status)
        });

        const total = this.state.total;
        const clampedProcessed = Math.min(this.state.processed, total);

        return {
            ...this.state,
            total: total,
            progress: total > 0
                ? Math.round((clampedProcessed / total) * 100)
                : 0
        };
    }
}

export const manualBackfillService = new ManualBackfillService();
