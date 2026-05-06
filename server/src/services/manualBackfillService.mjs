/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import db from '../config/database.mjs';
import { DB_ADVISORY_LOCKS } from '../config/database.mjs';
import embeddingService from './embeddingService.mjs';
import embeddingProvider from './embeddingProvider.mjs';
import embeddingRouter from './embeddingRouter.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('ManualBackfillService');

class ManualBackfillService {
    constructor() {
        this.state = this.createInitialState();
        this.isProcessing = false;
        this._lockClient = null;
        this._activeRunPromise = null;
    }

    createInitialState() {
        return {
            status: 'idle',
            processed: 0,
            total: 0,
            startTime: null,
            eta: null,
            batchSize: 50,
            error: null,
            runId: null,
            includeImage: false
        };
    }

    async tryAcquireSessionLock(lockClient, lockKey, message) {
        const { rows } = await lockClient.query(
            'SELECT pg_try_advisory_lock($1) AS acquired',
            [lockKey]
        );
        if (!rows[0].acquired) {
            throw new Error(message);
        }
    }

    async acquireLock() {
        if (this._lockClient) {
            return this._lockClient;
        }

        const lockClient = await db.pool.connect();
        let released = false;
        const acquiredLocks = [];
        try {
            await this.tryAcquireSessionLock(
                lockClient,
                DB_ADVISORY_LOCKS.BACKFILL_OWNER,
                'Another backfill mode is already running'
            );
            acquiredLocks.push(DB_ADVISORY_LOCKS.BACKFILL_OWNER);
            await this.tryAcquireSessionLock(
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
        const candidate = options.batchSize ?? options.limit ?? configuredBatchSize ?? 50;
        const parsed = Number(candidate);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new Error('batchSize must be a positive integer');
        }
        return parsed;
    }

    buildProviderUnavailableMessage(availability = {}) {
        return `Embedding provider unavailable until ${availability.cooldownUntil || 'recovery probe succeeds'}`;
    }

    buildProviderBusyMessage(error = {}) {
        const holder = error.lockHolder ? ` held by ${error.lockHolder}` : '';
        return `Embedding provider busy${holder}. Backfill yielded to active traffic; resume later.`;
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

    async syncTrackedTotal(currentPending, { persist = true } = {}) {
        const pendingCount = Number(currentPending) || 0;
        const dynamicTotal = this.state.processed + Math.max(0, pendingCount);
        const nextTotal = Math.max(this.state.total, dynamicTotal);

        if (nextTotal === this.state.total) {
            return this.state.total;
        }

        this.state.total = nextTotal;
        this.updateETA();

        if (persist && this.state.runId) {
            await db.query(
                'UPDATE backfill_runs SET total = $1, processed = $2 WHERE id = $3',
                [this.state.total, this.state.processed, this.state.runId]
            );
        }

        return this.state.total;
    }

    async start(options = {}) {
        const configResult = await db.query(
            'SELECT rag_enabled, manual_backfill_batch_size FROM ai_provider_config WHERE id = 1'
        );
        if (configResult.rows.length === 0) {
            throw new Error('RAG configuration not found. Complete setup in Settings before running backfill.');
        }
        if (!configResult.rows[0].rag_enabled) {
            throw new Error('RAG is not enabled. Please enable RAG in settings before running backfill.');
        }

        if (['running', 'paused', 'cancelling'].includes(this.state.status) || this._activeRunPromise) {
            throw new Error('Backfill already running');
        }

        const availability = await embeddingService.getProviderAvailabilityStatus({ refresh: true });
        if (availability.status === 'cooldown' || availability.status === 'probing') {
            throw new Error(this.buildProviderUnavailableMessage(availability));
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
            logger.info('Warming up embedding model before batch processing');
            try {
                await embeddingProvider.warmup();
            } catch (error) {
                logger.warn('Model warmup failed, continuing anyway', { error: error.message });
            }

            while (this.state.status === 'running' && this.state.processed < this.state.total) {
                const circuitStatus = embeddingRouter.getCircuitStatus();
                if (circuitStatus.state === 'OPEN') {
                    logger.warn('Circuit breaker is OPEN, pausing backfill');
                    this.state.status = 'paused';
                    this.state.error = 'Circuit breaker OPEN - too many failures. Please reset and try again.';
                    break;
                }

                const currentPending = await this.getPendingCount(this.state.includeImage);
                await this.syncTrackedTotal(currentPending);

                const pending = await this.getPendingEmbeddings(this.state.batchSize, this.state.includeImage);

                if (pending.length === 0) {
                    logger.info('No more pending embeddings');
                    break;
                }

                for (const item of pending) {
                    if (this.state.status !== 'running') {
                        break;
                    }

                    try {
                        let generationResult = null;
                        if (item.needsText) {
                            generationResult = await embeddingService.generateAndStore(item.id, {
                                ...item.metadata,
                                title: item.title,
                                media_type: item.media_type,
                                library_name: item.library_name
                            });
                        } else if (item.needsImage) {
                            generationResult = await embeddingService.generateImageEmbedding(item.id, {
                                ...item.metadata,
                                title: item.title,
                                media_type: item.media_type,
                                library_name: item.library_name
                            });
                        }

                        if (!generationResult) {
                            logger.debug('Manual backfill item was not stored; leaving it pending', {
                                id: item.id,
                                title: item.title
                            });
                            continue;
                        }

                        this.state.processed++;
                        this.updateETA();

                        if (this.state.processed % 5 === 0) {
                            await db.query(
                                'UPDATE backfill_runs SET processed = $1 WHERE id = $2',
                                [this.state.processed, this.state.runId]
                            );
                        }
                    } catch (error) {
                        if (error.message === 'PROVIDER_OFFLINE') {
                            const offlineStatus = embeddingService.getProviderAvailabilityStatus();
                            this.state.status = 'paused';
                            this.state.error = `${this.buildProviderUnavailableMessage(offlineStatus)}.`;
                            logger.warn('Manual backfill paused: embedding provider unavailable', {
                                retryAt: offlineStatus.cooldownUntil
                            }, { skipDbPersist: true });
                            break;
                        }

                        if (embeddingService.isProviderBusyError(error)) {
                            this.state.status = 'paused';
                            this.state.error = this.buildProviderBusyMessage(error);
                            logger.info('Manual backfill paused: embedding provider busy', {
                                id: item.id,
                                title: item.title,
                                lockHolder: error.lockHolder || null,
                                waitMs: error.waitMs || null,
                                activeModel: error.activeModel || null
                            });
                            break;
                        }

                        logger.error('Failed to generate embedding', {
                            id: item.id,
                            title: item.title,
                            error: error.message
                        }, { error });
                        const itemErrorMessage = `Item ${item.id}: ${error.message}`;
                        if (this.state.error) {
                            this.state.error += ` | ${itemErrorMessage}`;
                        } else {
                            this.state.error = itemErrorMessage;
                        }
                    }
                }
            }

            if (this.state.status === 'cancelling') {
                await db.query(`
                    UPDATE backfill_runs
                    SET status = 'cancelled',
                        completed_at = NOW(),
                        processed = $1,
                        total = $2,
                        error = $3
                    WHERE id = $4
                `, [this.state.processed, this.state.total, this.state.error, this.state.runId]);

                logger.info('Manual backfill cancelled', { processed: this.state.processed });
                return;
            }

            if (this.state.status === 'paused') {
                await db.query(`
                    UPDATE backfill_runs
                    SET status = 'paused',
                        error = $1,
                        processed = $2,
                        total = $3
                    WHERE id = $4
                `, [this.state.error, this.state.processed, this.state.total, this.state.runId]);

                logger.info('Manual backfill paused', {
                    processed: this.state.processed,
                    reason: this.state.error
                });
                return;
            }

            if (this.state.status === 'running') {
                this.state.status = 'completed';

                await db.query(`
                    UPDATE backfill_runs 
                    SET status = 'completed', 
                        completed_at = NOW(),
                        processed = $1,
                        total = $2
                    WHERE id = $3
                `, [this.state.processed, this.state.total, this.state.runId]);

                logger.info('Manual backfill completed', { processed: this.state.processed });
            }
        } catch (error) {
            logger.error('Backfill run error', { error: error.message }, { error });
            this.state.error = error.message;
            this.state.status = 'failed';

            if (this.state.runId) {
                await db.query(`
                    UPDATE backfill_runs 
                    SET status = 'failed', 
                        completed_at = NOW(),
                        error = $1,
                        processed = $2,
                        total = $3
                    WHERE id = $4
                `, [error.message, this.state.processed, this.state.total, this.state.runId]);
            }
        } finally {
            this.isProcessing = false;
            await this.releaseLock('unlock advisory lock');
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

    updateETA() {
        if (this.state.processed > 0) {
            const elapsed = Date.now() - this.state.startTime;
            const avgTimePerItem = elapsed / this.state.processed;
            const remaining = this.state.total - this.state.processed;
            this.state.eta = Math.max(0, Math.round(remaining * avgTimePerItem / 1000));
        }
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

export default new ManualBackfillService();
