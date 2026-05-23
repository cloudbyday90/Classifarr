import * as db from '../config/database.mjs';
import { embeddingService } from './embeddingService.mjs';
import { embeddingProvider } from './embeddingProvider.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('ManualBackfillService');

export function createInitialState() {
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

export async function tryAcquireSessionLock(lockClient, lockKey, message) {
    const { rows } = await lockClient.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [lockKey]
    );
    if (!rows[0].acquired) {
        throw new Error(message);
    }
}

export function resolveBatchSize(options = {}, configuredBatchSize = null) {
    const candidate = options.batchSize ?? options.limit ?? configuredBatchSize ?? 50;
    const parsed = Number(candidate);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('batchSize must be a positive integer');
    }
    return parsed;
}

export function buildProviderUnavailableMessage(availability = {}) {
    return `Embedding provider unavailable until ${availability.cooldownUntil || 'recovery probe succeeds'}`;
}

export function buildProviderBusyMessage(error = {}) {
    const holder = error.lockHolder ? ` held by ${error.lockHolder}` : '';
    return `Embedding provider busy${holder}. Backfill yielded to active traffic; resume later.`;
}

export function updateETA(state) {
    if (state.processed > 0) {
        const elapsed = Date.now() - state.startTime;
        const avgTimePerItem = elapsed / state.processed;
        const remaining = state.total - state.processed;
        state.eta = Math.max(0, Math.round(remaining * avgTimePerItem / 1000));
    }
}

export async function syncTrackedTotal(state, currentPending, { persist = true } = {}) {
    const pendingCount = Number(currentPending) || 0;
    const dynamicTotal = state.processed + Math.max(0, pendingCount);
    const nextTotal = Math.max(state.total, dynamicTotal);

    if (nextTotal === state.total) {
        return state.total;
    }

    state.total = nextTotal;
    updateETA(state);

    if (persist && state.runId) {
        await db.query(
            'UPDATE backfill_runs SET total = $1, processed = $2 WHERE id = $3',
            [state.total, state.processed, state.runId]
        );
    }

    return state.total;
}

export async function runBackfill(state, { releaseLock }) {
    logger.info('Warming up embedding model before batch processing');
    try {
        await embeddingProvider.warmup();
    } catch (error) {
        logger.warn('Model warmup failed, continuing anyway', { error: error.message });
    }

    try {
        while (state.status === 'running' && state.processed < state.total) {
            const circuitStatus = embeddingRouter.getCircuitStatus();
            if (circuitStatus.state === 'OPEN') {
                logger.warn('Circuit breaker is OPEN, pausing backfill');
                state.status = 'paused';
                state.error = 'Circuit breaker OPEN - too many failures. Please reset and try again.';
                break;
            }

            const currentPending = await embeddingService.getPendingCount({ includeImage: state.includeImage });
            await syncTrackedTotal(state, currentPending);

            const pending = await embeddingService.getPendingEmbeddings({
                limit: state.batchSize,
                includeImage: state.includeImage
            });

            if (pending.length === 0) {
                logger.info('No more pending embeddings');
                break;
            }

            for (const item of pending) {
                if (state.status !== 'running') {
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

                    state.processed++;
                    updateETA(state);

                    if (state.processed % 5 === 0) {
                        await db.query(
                            'UPDATE backfill_runs SET processed = $1 WHERE id = $2',
                            [state.processed, state.runId]
                        );
                    }
                } catch (error) {
                    if (error.message === 'PROVIDER_OFFLINE') {
                        const offlineStatus = embeddingService.getProviderAvailabilityStatus();
                        state.status = 'paused';
                        state.error = `${buildProviderUnavailableMessage(offlineStatus)}.`;
                        logger.warn('Manual backfill paused: embedding provider unavailable', {
                            retryAt: offlineStatus.cooldownUntil
                        }, { skipDbPersist: true });
                        break;
                    }

                    if (embeddingService.isProviderBusyError(error)) {
                        state.status = 'paused';
                        state.error = buildProviderBusyMessage(error);
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
                    if (state.error) {
                        state.error += ` | ${itemErrorMessage}`;
                    } else {
                        state.error = itemErrorMessage;
                    }
                }
            }
        }

        if (state.status === 'cancelling') {
            await db.query(`
                UPDATE backfill_runs
                SET status = 'cancelled',
                    completed_at = NOW(),
                    processed = $1,
                    total = $2,
                    error = $3
                WHERE id = $4
            `, [state.processed, state.total, state.error, state.runId]);

            logger.info('Manual backfill cancelled', { processed: state.processed });
            return;
        }

        if (state.status === 'paused') {
            await db.query(`
                UPDATE backfill_runs
                SET status = 'paused',
                    error = $1,
                    processed = $2,
                    total = $3
                WHERE id = $4
            `, [state.error, state.processed, state.total, state.runId]);

            logger.info('Manual backfill paused', {
                processed: state.processed,
                reason: state.error
            });
            return;
        }

        if (state.status === 'running') {
            state.status = 'completed';

            await db.query(`
                UPDATE backfill_runs 
                SET status = 'completed', 
                    completed_at = NOW(),
                    processed = $1,
                    total = $2
                WHERE id = $3
            `, [state.processed, state.total, state.runId]);

            logger.info('Manual backfill completed', { processed: state.processed });
        }
    } catch (error) {
        logger.error('Backfill run error', { error: error.message }, { error });
        state.error = error.message;
        state.status = 'failed';

        if (state.runId) {
            await db.query(`
                UPDATE backfill_runs 
                SET status = 'failed', 
                    completed_at = NOW(),
                    error = $1,
                    processed = $2,
                    total = $3
                WHERE id = $4
            `, [error.message, state.processed, state.total, state.runId]);
        }
    } finally {
        await releaseLock('unlock advisory lock');
    }
}
