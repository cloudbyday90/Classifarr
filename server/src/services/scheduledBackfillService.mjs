/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { withSessionAdvisoryLock, DB_ADVISORY_LOCKS } from '../config/database.mjs';
import { embeddingService } from './embeddingService.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as backfillHelpers from '../utils/backfillHelpers.mjs';
import { isTextBackfillConfigured } from './idleBackfillConfig.mjs';
import { runScheduledBackfillLoop } from './scheduledBackfillProcessing.mjs';

const logger = createLogger('ScheduledBackfillService');

class ScheduledBackfillService {
    constructor(deps = {}) {
        this.backfillHelpers = deps.backfillHelpers || backfillHelpers;
        this.schedule = {
            enabled: false,
            time: '02:00',
            days: [0, 1, 2, 3, 4, 5, 6],
            batchSize: 100,
            maxDuration: 3600000
        };
        this.schedulerInterval = null;
        this.isRunning = false;
        this.lastCheckTime = null;
        this.shouldContinueRunning = false;
    }

    async loadScheduleConfig() {
        try {
            const { parseDaysConfig } = this.backfillHelpers;
            const result = await db.query(`
                SELECT
                    rag_enabled,
                    scheduled_backfill_enabled,
                    scheduled_backfill_time,
                    scheduled_backfill_days,
                    scheduled_backfill_batch_size,
                    scheduled_backfill_max_duration,
                    embedding_provider_mode,
                    primary_provider,
                    embedding_ollama_host,
                    embedding_cloud_provider,
                    embedding_cloud_api_key
                FROM ai_provider_config
                WHERE id = 1
            `);

            if (result.rows.length > 0) {
                const row = result.rows[0];
                this.schedule = {
                    ragEnabled: row.rag_enabled || false,
                    enabled: row.scheduled_backfill_enabled || false,
                    time: row.scheduled_backfill_time || '02:00',
                    days: parseDaysConfig(row.scheduled_backfill_days),
                    batchSize: row.scheduled_backfill_batch_size || 100,
                    maxDuration: row.scheduled_backfill_max_duration || 3600000,
                    _providerConfig: row,
                };
            }

            return this.schedule;
        } catch (error) {
            logger.error('Failed to load schedule config', { error: error.message });
            return this.schedule;
        }
    }

    async initScheduler() {
        await this.loadScheduleConfig();

        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
        }

        logger.info('Initializing scheduled backfill', { schedule: this.schedule });

        this.schedulerInterval = setInterval(() => {
            this.checkSchedule();
        }, 60000);
    }

    async checkSchedule() {
        if (!this.schedule.enabled) {
            return;
        }

        if (this.isRunning) {
            return;
        }

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentDay = now.getDay();

        if (this.lastCheckTime === currentTime) {
            return;
        }

        if (currentTime === this.schedule.time && this.schedule.days.includes(currentDay)) {
            this.lastCheckTime = currentTime;
            logger.info('Triggering scheduled backfill', { time: currentTime, day: currentDay });
            await this.runScheduledBackfill();
        }
    }

    async getPendingEmbeddings(limit) {
        const includeImage = await embeddingService.shouldIncludeImageEmbeddings();
        return await embeddingService.getPendingEmbeddings({
            limit,
            includeImage
        });
    }

    async runScheduledBackfill() {
        await this.loadScheduleConfig();

        if (!this.schedule.ragEnabled) {
            logger.debug('RAG is not enabled, skipping scheduled backfill');
            return;
        }

        const availability = await embeddingService.getProviderAvailabilityStatus({ refresh: true });
        if (availability.status === 'cooldown' || availability.status === 'probing') {
            logger.info('Scheduled backfill skipped: embedding provider unavailable', {
                retryAt: availability.cooldownUntil
            }, { skipDbPersist: true });
            return;
        }

        if (this.isRunning) {
            logger.warn('Scheduled backfill already running');
            return;
        }

        const providerConfig = this.schedule._providerConfig || {};
        const textReady = isTextBackfillConfigured(providerConfig);
        const imageReady = await embeddingService.shouldIncludeImageEmbeddings();
        if (!textReady && !imageReady) {
            logger.info('Scheduled backfill skipped: text and image embedding providers are not configured');
            return;
        }

        const lockAcquired = await withSessionAdvisoryLock(
            DB_ADVISORY_LOCKS.BACKFILL_OWNER,
            async () => {
                this.isRunning = true;
                this.shouldContinueRunning = true;
                const startTime = Date.now();
                const includeImage = imageReady;

                logger.info('Starting scheduled backfill', {
                    batchSize: this.schedule.batchSize,
                    maxDuration: this.schedule.maxDuration
                });

                const runResult = await db.query(`
                    INSERT INTO backfill_runs (type, status)
                    VALUES ('scheduled', 'running')
                    RETURNING id
                `);
                const runId = runResult.rows[0].id;

                try {
                    const loopResult = await runScheduledBackfillLoop({
                        batchSize: this.schedule.batchSize,
                        runId,
                        maxDuration: this.schedule.maxDuration,
                        startTime,
                        shouldContinue: { get value() { return scheduledBackfillService.shouldContinueRunning; } },
                        signalStop: () => { scheduledBackfillService.shouldContinueRunning = false; },
                        includeImage,
                    });

                    const duration = Date.now() - startTime;
                    const finalStatus = loopResult.providerUnavailable
                        ? 'completed'
                        : (this.shouldContinueRunning ? 'completed' : 'cancelled');

                    await db.query(`
                        UPDATE backfill_runs
                        SET status = $1,
                            completed_at = NOW(),
                            processed = $2
                        WHERE id = $3
                    `, [finalStatus, loopResult.processed, runId]);

                    logger.info(`Scheduled backfill ${finalStatus}`, {
                        processed: loopResult.processed,
                        durationMs: duration,
                        providerBusy: loopResult.providerBusy
                    });
                } catch (error) {
                    logger.error('Scheduled backfill error', { error: error.message }, { error });

                    await db.query(`
                        UPDATE backfill_runs
                        SET status = 'failed',
                            completed_at = NOW(),
                            error = $1,
                            processed = $2
                        WHERE id = $3
                    `, [error.message, 0, runId]);
                } finally {
                    this.isRunning = false;
                    this.shouldContinueRunning = false;
                }
            }
        );
        if (!lockAcquired) {
            logger.info('Scheduled backfill skipped: another backfill mode already owns the worker');
        }
    }

    updateSchedule(newSchedule) {
        this.schedule = { ...this.schedule, ...newSchedule };
        logger.info('Schedule updated', { schedule: this.schedule });
    }

    getSchedule() {
        return this.schedule;
    }

    getStatus() {
        return {
            ...this.schedule,
            status: this.isRunning ? 'running' : (this.schedule.enabled ? 'enabled' : 'disabled'),
            isRunning: this.isRunning,
            lastCheckTime: this.lastCheckTime,
            stopRequested: this.isRunning ? !this.shouldContinueRunning : false
        };
    }

    stop() {
        this.shouldContinueRunning = false;
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
            logger.info('Scheduled backfill stopped');
        }
    }
}

export const scheduledBackfillService = new ScheduledBackfillService();
