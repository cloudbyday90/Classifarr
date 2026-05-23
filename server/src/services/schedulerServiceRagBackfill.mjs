import * as db from '../config/database.mjs';
import { embeddingService } from './embeddingService.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('SchedulerRagBackfill');

export async function checkRagBackfillSchedule({ runRagBackfill }) {
    try {
        const configResult = await db.query(
            'SELECT rag_enabled FROM ai_provider_config WHERE id = 1'
        );
        const ragEnabled = configResult.rows[0]?.rag_enabled === true;

        if (!ragEnabled) return;

        const includeImage = await embeddingService.shouldIncludeImageEmbeddings();
        const pendingCount = await embeddingService.getPendingCount({ includeImage });

        if (pendingCount === 0) return;

        const availability = await embeddingService.getProviderAvailabilityStatus({ refresh: true });
        if (availability.status === 'cooldown' || availability.status === 'probing') {
            logger.debug('RAG backfill: skipped because embedding provider is unavailable', {
                retryAt: availability.cooldownUntil
            });
            return;
        }

        const statusResult = await db.query(`
            SELECT
                EXISTS(
                    SELECT 1 FROM backfill_runs
                    WHERE type = 'scheduler' AND status = 'running'
                ) AS is_running,
                (
                    SELECT MAX(completed_at)
                    FROM backfill_runs
                    WHERE type = 'scheduler' AND status = 'completed'
                ) AS last_run
        `);
        const { is_running: isRunning, last_run: lastRun } = statusResult.rows[0];

        if (isRunning) {
            logger.debug('RAG backfill: skipped (run already in progress)');
            return;
        }

        const shouldRun = !lastRun || (Date.now() - new Date(lastRun).getTime()) > 5 * 60 * 1000;

        if (shouldRun) {
            logger.info(`RAG backfill: ${pendingCount} items pending. Processing batch...`);
            await runRagBackfill();
        }
    } catch (error) {
        logger.error('Error checking RAG backfill schedule', { error: error.message }, { error });
    }
}

export async function runRagBackfill() {
    let runId = null;
    try {
        const includeImage = await embeddingService.shouldIncludeImageEmbeddings();
        const pending = await embeddingService.getPendingEmbeddings({
            limit: 10,
            includeImage
        });

        if (pending.length === 0) return;

        const runResult = await db.query(
            `INSERT INTO backfill_runs (type, status, total) VALUES ('scheduler', 'running', $1) RETURNING id`,
            [pending.length]
        );
        runId = runResult.rows[0].id;

        let processed = 0;
        let failed = 0;
        let providerUnavailable = false;
        let providerBusy = false;

        for (const row of pending) {
            try {
                const metadata = row.metadata || {};
                let generationResult = null;
                if (row.needsText) {
                    generationResult = await embeddingService.generateAndStore(row.id, {
                        ...metadata,
                        title: row.title,
                        media_type: row.media_type,
                        library_name: row.library_name
                    });
                } else if (row.needsImage) {
                    generationResult = await embeddingService.generateImageEmbedding(row.id, {
                        ...metadata,
                        title: row.title,
                        media_type: row.media_type,
                        library_name: row.library_name
                    });
                }

                if (!generationResult) {
                    logger.debug('RAG backfill item was not stored; leaving it pending', {
                        id: row.id,
                        title: row.title
                    });
                    continue;
                }

                processed++;
            } catch (error) {
                if (error.message === 'PROVIDER_OFFLINE') {
                    providerUnavailable = true;
                    const availability = embeddingService.getProviderAvailabilityStatus();
                    logger.debug('RAG backfill batch paused: embedding provider unavailable', {
                        retryAt: availability.cooldownUntil
                    });
                    break;
                }

                if (embeddingService.isProviderBusyError(error)) {
                    providerBusy = true;
                    logger.debug('RAG backfill batch yielded to active provider traffic', {
                        id: row.id,
                        lockHolder: error.lockHolder || null,
                        waitMs: error.waitMs || null,
                        activeModel: error.activeModel || null
                    });
                    break;
                }

                failed++;
                logger.debug('Backfill item failed', { id: row.id, error: error.message });
            }
        }

        await db.query(
            `UPDATE backfill_runs SET status = 'completed', completed_at = NOW(), processed = $1 WHERE id = $2`,
            [processed, runId]
        );

        if (processed > 0 || providerUnavailable || providerBusy) {
            logger.info('RAG backfill batch complete', { processed, failed, providerBusy });
        }
    } catch (error) {
        logger.error('RAG backfill failed', { error: error.message }, { error });
        if (runId) {
            await db.query(
                `UPDATE backfill_runs SET status = 'failed', completed_at = NOW(), error = $1 WHERE id = $2`,
                [error.message, runId]
            ).catch(() => {}); // swallow-error: best-effort DB status update — must not block or mask the main error
        }
    }
}
