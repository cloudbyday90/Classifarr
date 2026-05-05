/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import db from '../config/database.mjs';
import { withSessionAdvisoryLock, DB_ADVISORY_LOCKS } from '../config/database.mjs';
import embeddingService from './embeddingService.mjs';
import { createResolvedLoader, loadResolvedDependency } from './shared/resolvedLoader.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as backfillHelpers from '../utils/backfillHelpers.mjs';

const logger = createLogger('ScheduledBackfillService');

class ScheduledBackfillService {
    constructor() {
        this.loadBackfillHelpers = createResolvedLoader(backfillHelpers);
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
            const { parseDaysConfig } = await loadResolvedDependency(this.loadBackfillHelpers);
            const result = await db.query(`
                SELECT 
                    rag_enabled,
                    scheduled_backfill_enabled,
                    scheduled_backfill_time,
                    scheduled_backfill_days,
                    scheduled_backfill_batch_size,
                    scheduled_backfill_max_duration
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
                    maxDuration: row.scheduled_backfill_max_duration || 3600000
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

        const lockAcquired = await withSessionAdvisoryLock(
            DB_ADVISORY_LOCKS.BACKFILL_OWNER,
            async () => {
                this.isRunning = true;
                this.shouldContinueRunning = true;
                const startTime = Date.now();
                let processed = 0;
                const includeImage = await embeddingService.shouldIncludeImageEmbeddings();
                let providerUnavailable = false;
                let providerBusy = false;

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
                    while (this.shouldContinueRunning && Date.now() - startTime < this.schedule.maxDuration) {
                        const pending = await embeddingService.getPendingEmbeddings({
                            limit: this.schedule.batchSize,
                            includeImage
                        });

                        if (pending.length === 0) {
                            logger.info('No more pending embeddings');
                            break;
                        }

                        for (const item of pending) {
                            if (!this.shouldContinueRunning) {
                                logger.info('Scheduled backfill stop requested, ending active run');
                                break;
                            }

                            if (Date.now() - startTime >= this.schedule.maxDuration) {
                                logger.info('Max duration reached, stopping scheduled backfill');
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
                                    logger.debug('Scheduled backfill item was not stored; leaving it pending', {
                                        id: item.id,
                                        title: item.title
                                    });
                                    continue;
                                }

                                processed++;

                                if (processed % 10 === 0) {
                                    await db.query(
                                        'UPDATE backfill_runs SET processed = $1 WHERE id = $2',
                                        [processed, runId]
                                    );
                                }
                            } catch (error) {
                                if (error.message === 'PROVIDER_OFFLINE') {
                                    providerUnavailable = true;
                                    this.shouldContinueRunning = false;
                                    const offlineStatus = embeddingService.getProviderAvailabilityStatus();
                                    logger.warn('Scheduled backfill paused: embedding provider unavailable', {
                                        retryAt: offlineStatus.cooldownUntil
                                    }, { skipDbPersist: true });
                                    break;
                                }

                                if (embeddingService.isProviderBusyError(error)) {
                                    providerBusy = true;
                                    this.shouldContinueRunning = false;
                                    logger.info('Scheduled backfill yielded to active provider traffic', {
                                        id: item.id,
                                        title: item.title,
                                        lockHolder: error.lockHolder || null,
                                        waitMs: error.waitMs || null,
                                        activeModel: error.activeModel || null
                                    });
                                    break;
                                }

                                logger.error('Failed to generate embedding in scheduled backfill', {
                                    id: item.id,
                                    title: item.title,
                                    error: error.message
                                }, { error });
                            }
                        }
                    }

                    const duration = Date.now() - startTime;
                    const finalStatus = providerUnavailable
                        ? 'completed'
                        : (this.shouldContinueRunning ? 'completed' : 'cancelled');

                    await db.query(`
                        UPDATE backfill_runs 
                        SET status = $1, 
                            completed_at = NOW(),
                            processed = $2
                        WHERE id = $3
                    `, [finalStatus, processed, runId]);

                    logger.info(`Scheduled backfill ${finalStatus}`, {
                        processed,
                        durationMs: duration,
                        providerBusy
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
                    `, [error.message, processed, runId]);
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

export default new ScheduledBackfillService();
