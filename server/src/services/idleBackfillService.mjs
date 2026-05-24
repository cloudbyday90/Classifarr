/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { setTimeout as sleepFor } from 'node:timers/promises';
import * as db from '../config/database.mjs';
import { withSessionAdvisoryLock, DB_ADVISORY_LOCKS } from '../config/database.mjs';
import { embeddingService } from './embeddingService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { idleDetector as defaultIdleDetector } from '../utils/idleDetector.mjs';
import { isTextBackfillConfigured, loadIdleBackfillConfig } from './idleBackfillConfig.mjs';
import { runIdleBackfillLoop } from './idleBackfillProcessing.mjs';

const logger = createLogger('IdleBackfillService');

class IdleBackfillService {
    constructor(deps = {}) {
        this.isRunning = false;
        this.batchSize = 10;
        this.config = null;
        this.manualBackfillService = null;
        this.includeText = true;
        this.includeImage = false;
        this.idleDetector = deps.idleDetector || defaultIdleDetector;
    }

    async getIdleDetector() {
        return this.idleDetector;
    }

    setManualBackfillService(service) {
        this.manualBackfillService = service;
    }

    async loadConfig() {
        const activeIdleDetector = await this.getIdleDetector();
        const config = await loadIdleBackfillConfig({ idleDetector: activeIdleDetector });

        if (config && config.idle_batch_size) {
            this.batchSize = config.idle_batch_size || 10;
        }

        this.config = config;
        return config;
    }

    async getPendingCount() {
        return await embeddingService.getPendingCount({
            includeText: this.includeText,
            includeImage: this.includeImage
        });
    }

    async getPendingEmbeddings(limit = 10) {
        return await embeddingService.getPendingEmbeddings({
            limit,
            includeText: this.includeText,
            includeImage: this.includeImage
        });
    }

    async startIdleBackfill() {
        let runId = null;

        try {
            const activeIdleDetector = await this.getIdleDetector();
            const config = await this.loadConfig();

            if (!config) {
                logger.warn('Idle backfill NOT started: configuration could not be loaded (DB error)');
                return;
            }

            if (!config.rag_enabled) {
                logger.info('Idle backfill NOT started: RAG is disabled in settings');
                return;
            }

            if (!config.idle_backfill_enabled) {
                logger.info('Idle backfill NOT started: Idle backfill is disabled in settings');
                return;
            }

            if (this.isRunning) {
                logger.info('Idle backfill NOT started: Already running');
                return;
            }

            const availability = await embeddingService.getProviderAvailabilityStatus({ refresh: true });
            if (availability.status === 'cooldown' || availability.status === 'probing') {
                logger.info('Idle backfill NOT started: Provider offline cooldown active', {
                    retryAt: availability.cooldownUntil
                });
                return;
            }

            this.includeText = isTextBackfillConfigured(config);
            this.includeImage = await embeddingService.shouldIncludeImageEmbeddings();

            if (!this.includeText && !this.includeImage) {
                logger.info('Idle backfill NOT started: text and image embedding providers are not configured');
                return;
            }

            const pendingCount = await this.getPendingCount();
            if (pendingCount === 0) {
                logger.info('Idle backfill NOT started: No pending embeddings');
                return;
            }

            const lockAcquired = await withSessionAdvisoryLock(
                DB_ADVISORY_LOCKS.BACKFILL_OWNER,
                async () => {
                    const runResult = await db.query(`
                        INSERT INTO backfill_runs (type, status, total)
                        VALUES ('idle', 'running', $1)
                        RETURNING id
                    `, [pendingCount]);
                    runId = runResult.rows[0].id;

                    this.isRunning = true;
                    logger.info('Starting idle backfill...', { pending: pendingCount, runId });

                    let totalProcessed = 0;
                    let deferredForBusy = false;

                    try {
                        const loopResult = await runIdleBackfillLoop({
                            batchSize: this.batchSize,
                            runId,
                            isIdle: () => activeIdleDetector.isIdle(),
                            getPendingEmbeddings: (limit) => this.getPendingEmbeddings(limit),
                            getManualBackfillStatus: this.manualBackfillService
                                ? () => this.manualBackfillService.getStatus()
                                : null,
                            sleep: (ms) => this.sleep(ms),
                        });

                        totalProcessed = loopResult.totalProcessed;
                        deferredForBusy = loopResult.deferredForBusy;

                        await db.query(`
                            UPDATE backfill_runs
                            SET status = 'completed',
                                completed_at = NOW(),
                                processed = $1
                            WHERE id = $2
                        `, [totalProcessed, runId]);

                        logger.info('Idle backfill completed', {
                            processed: totalProcessed,
                            deferredForBusy
                        });
                    } catch (error) {
                        logger.error('Idle backfill error', { error: error.message }, { error });

                        await db.query(`
                            UPDATE backfill_runs
                            SET status = 'failed',
                                completed_at = NOW(),
                                error = $1,
                                processed = $2
                            WHERE id = $3
                        `, [error.message, totalProcessed, runId]);
                    } finally {
                        this.isRunning = false;
                    }
                }
            );
            if (!lockAcquired) {
                logger.info('Idle backfill skipped: another backfill mode already owns the worker');
            }
        } catch (error) {
            logger.error('Idle backfill startup error', { error: error.message });
            this.isRunning = false;

            if (runId) {
                try {
                    await db.query(`
                        UPDATE backfill_runs
                        SET status = 'failed',
                            completed_at = NOW(),
                            error = $1
                        WHERE id = $2
                    `, [error.message, runId]);
                } catch (dbError) {
                    logger.error('Failed to update backfill run status', { error: dbError.message });
                }
            }
            return;
        }
    }

    stopIdleBackfill() {
        if (this.isRunning) {
            logger.info('Stopping idle backfill');
            this.isRunning = false;
        }
    }

    sleep(ms) {
        return sleepFor(ms);
    }

    getStatus() {
        const enabled = this.config?.idle_backfill_enabled === true;
        const availability = embeddingService.getProviderAvailabilityStatus();
        const cooldownActive = availability.status === 'cooldown' || availability.status === 'probing';
        const status = this.isRunning
            ? 'running'
            : cooldownActive
                ? 'cooldown'
                : enabled
                    ? 'enabled'
                    : 'disabled';

        return {
            status,
            enabled,
            isRunning: this.isRunning,
            batchSize: this.batchSize,
            includeImage: this.includeImage,
            cooldownUntil: cooldownActive ? availability.cooldownUntil : null,
            config: this.config
        };
    }
}

export const idleBackfillService = new IdleBackfillService();
