/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { setImmediate as yieldForTurn, setTimeout as waitFor } from 'node:timers/promises';
import * as db from '../config/database.mjs';
import {
    QUEUE_TASK_FAILURE_REASON_IDS,
    QUEUE_TASK_RECOVERY_LOG_REASON_IDS,
} from './queueTaskFailureReason.mjs';

const { DB_ADVISORY_LOCKS } = db;

const DEFAULT_VISIBILITY_TIMEOUT_MINUTES = parseInt(process.env.TASK_VISIBILITY_TIMEOUT_MINUTES || '10', 10);

export class QueueWorkerLoopService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.aiRouterService = deps.aiRouterService;
        this.ollamaService = deps.ollamaService;
        this.visibilityTimeoutMinutes = deps.visibilityTimeoutMinutes || DEFAULT_VISIBILITY_TIMEOUT_MINUTES;
        this.getState = deps.getState || (() => ({
            running: false,
            processing: 0,
            lastRecoveryCheck: 0,
            fullConcurrencyStartedAt: 0,
            aiAvailable: true,
            lastAiAvailabilityProbeAt: 0,
        }));
        this.setRunning = deps.setRunning || (() => {});
        this.incrementProcessing = deps.incrementProcessing || (() => {});
        this.decrementProcessing = deps.decrementProcessing || (() => {});
        this.setLastRecoveryCheck = deps.setLastRecoveryCheck || (() => {});
        this.setFullConcurrencyStartedAt = deps.setFullConcurrencyStartedAt || (() => {});
        this.setLastAiAvailabilityProbeAt = deps.setLastAiAvailabilityProbeAt || (() => {});
        this.setAiAvailable = deps.setAiAvailable || (() => {});
        this.backgroundDrainIfBloated = deps.backgroundDrainIfBloated || (async () => {});
        this.hasClassificationDispatchBlocker = deps.hasClassificationDispatchBlocker || (async () => ({
            hasProcessingClassification: false,
            lookupFailed: false,
        }));
        this.dequeue = deps.dequeue || (async () => null);
        this.processTask = deps.processTask || (async () => {});
        this.getConcurrencySettings = deps.getConcurrencySettings || (async () => ({
            generalWorkers: 1,
            metadataEnrichmentWorkers: 5,
        }));
        this.pollIntervalMs = deps.pollIntervalMs || 1000;
        this.maxConcurrent = deps.maxConcurrent || 5;
        this.visibilityRecoveryIntervalMs = deps.visibilityRecoveryIntervalMs || 60_000;
        this.stallWarnIntervalMs = deps.stallWarnIntervalMs || 30_000;
        this.aiAvailabilityProbeIntervalMs = deps.aiAvailabilityProbeIntervalMs || 30_000;
        this.wait = deps.wait || ((ms) => waitFor(ms));
        this.yieldToEventLoop = deps.yieldToEventLoop || (() => yieldForTurn());
    }

    async requeueTask(taskId) {
        await this.db.query(
            `UPDATE task_queue SET status = 'pending', started_at = NULL, visible_at = NULL WHERE id = $1`,
            [taskId]
        );
    }

    async checkAIAvailability() {
        if (!this.aiRouterService?.checkAvailability) {
            return true;
        }

        const wasAvailable = this.getState().aiAvailable;
        const nowAvailable = await this.aiRouterService.checkAvailability(
            wasAvailable,
            this.ollamaService,
            this.logger,
        );
        this.setAiAvailable(nowAvailable);
        return nowAvailable;
    }

    maybeRunVisibilityRecovery(now) {
        const state = this.getState();
        if (now - state.lastRecoveryCheck < this.visibilityRecoveryIntervalMs) {
            return;
        }

        this.setLastRecoveryCheck(now);
        this.recoverExpiredVisibilityTasks().catch(() => {
            this.logger.error('Visibility timeout recovery failed', {
                reasonCode: QUEUE_TASK_RECOVERY_LOG_REASON_IDS.VISIBILITY_RECOVERY_FAILED,
            });
        });
    }

    updateConcurrencyStallState(now) {
        const state = this.getState();

        if (state.processing >= this.maxConcurrent) {
            if (state.fullConcurrencyStartedAt === 0) {
                this.setFullConcurrencyStartedAt(now);
            } else if (now - state.fullConcurrencyStartedAt >= this.stallWarnIntervalMs) {
                this.logger.warn('Worker at max concurrency for >30 s — possible row-lock stall; tasks will self-recover via statement timeout or visibility window', {
                    processing: state.processing,
                    maxConcurrent: this.maxConcurrent,
                    durationMs: now - state.fullConcurrencyStartedAt,
                });
                this.setFullConcurrencyStartedAt(now);
            }
            return;
        }

        this.setFullConcurrencyStartedAt(0);
    }

    async getEffectiveConcurrency() {
        const configured = await this.getConcurrencySettings();
        return {
            generalWorkers: Math.max(1, configured?.generalWorkers || 1),
            metadataEnrichmentWorkers: Math.max(1, configured?.metadataEnrichmentWorkers || 5),
        };
    }

    getActiveProcessingCounts() {
        const state = this.getState();
        const processingByType = state.processingByType || {};
        const metadataEnrichmentProcessing = processingByType.metadata_enrichment || 0;
        const totalProcessing = state.processing || 0;

        return {
            totalProcessing,
            metadataEnrichmentProcessing,
            nonMetadataProcessing: Math.max(totalProcessing - metadataEnrichmentProcessing, 0),
        };
    }

    async maybeDispatchTask() {
        const state = this.getState();
        const concurrency = await this.getEffectiveConcurrency();
        const {
            metadataEnrichmentProcessing,
            nonMetadataProcessing,
        } = this.getActiveProcessingCounts();

        const metadataSlotAvailable = metadataEnrichmentProcessing < concurrency.metadataEnrichmentWorkers;
        const nonMetadataSlotAvailable = nonMetadataProcessing < concurrency.generalWorkers;

        if (!metadataSlotAvailable && !nonMetadataSlotAvailable) {
            return false;
        }

        const blockers = await this.hasClassificationDispatchBlocker();
        let excludeClassification = blockers.lookupFailed || blockers.hasProcessingClassification;
        let aiReadiness = null;

        if (!excludeClassification && state.aiAvailable === false) {
            const now = Date.now();
            const shouldProbe = (now - (state.lastAiAvailabilityProbeAt || 0)) >= this.aiAvailabilityProbeIntervalMs;

            if (shouldProbe) {
                this.setLastAiAvailabilityProbeAt(now);
                aiReadiness = await this.checkAIAvailability();
                excludeClassification = !aiReadiness;
            } else {
                excludeClassification = true;
            }
        }

        const taskSelection = { excludeClassification };
        if (!metadataSlotAvailable && nonMetadataSlotAvailable) {
            taskSelection.excludeTaskTypes = ['metadata_enrichment'];
        } else if (metadataSlotAvailable && !nonMetadataSlotAvailable) {
            taskSelection.onlyTaskTypes = ['metadata_enrichment'];
        }

        const task = await this.dequeue(taskSelection);

        if (!task) {
            return false;
        }

        if (task.task_type === 'classification') {
            const aiReady = aiReadiness ?? await this.checkAIAvailability();
            if (!aiReady) {
                await this.requeueTask(task.id);
                await this.wait(this.pollIntervalMs);
                return true;
            }
        }

        this.incrementProcessing(task.task_type);
        this.processTask(task).finally(() => {
            this.decrementProcessing(task.task_type);
        });

        await this.yieldToEventLoop();
        return true;
    }

    async resetStaleProcessingTasks() {
        try {
            return await this.db.withTransaction(async (client) => {
                const lockResult = await client.query(
                    'SELECT pg_try_advisory_xact_lock($1) AS acquired',
                    [DB_ADVISORY_LOCKS.STARTUP_RESET]
                );
                if (!lockResult.rows[0].acquired) {
                    this.logger.info('resetStaleProcessingTasks: skipped (another container holds startup lock)');
                    return 0;
                }
                const result = await client.query(
                    `UPDATE task_queue 
                     SET status = 'pending', started_at = NULL, visible_at = NULL,
                         error_message = $1
                     WHERE status = 'processing'
                       AND (started_at IS NULL OR started_at < NOW() - ($2::integer * INTERVAL '1 minute'))
                     RETURNING id`,
                    [
                        QUEUE_TASK_FAILURE_REASON_IDS.STARTUP_STALE_RECOVERED,
                        this.visibilityTimeoutMinutes,
                    ]
                );
                if (result.rowCount > 0) {
                    this.logger.warn('Reset stale processing tasks on startup', {
                        count: result.rowCount,
                        taskIds: result.rows.map(r => r.id)
                    });
                }
                return result.rowCount;
            });
        } catch {
            this.logger.error('Failed to reset stale tasks', {
                reasonCode: QUEUE_TASK_RECOVERY_LOG_REASON_IDS.STARTUP_RESET_FAILED,
            });
            return 0;
        }
    }

    async recoverExpiredVisibilityTasks() {
        try {
            const result = await this.db.query(
                `UPDATE task_queue
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = $1
                 WHERE status = 'processing'
                   AND visible_at IS NOT NULL
                   AND visible_at <= NOW()
                 RETURNING id, task_type`,
                [QUEUE_TASK_FAILURE_REASON_IDS.VISIBILITY_TIMEOUT_RECOVERED]
            );
            if (result.rowCount > 0) {
                for (const row of result.rows) {
                    this.decrementProcessing(row.task_type);
                }
                this.logger.warn('Recovered tasks with expired visibility timeout; decremented processing counter', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id),
                    processingAfter: this.getState().processing,
                });
            }
            return result.rowCount;
        } catch {
            this.logger.error('Failed to recover expired visibility tasks', {
                reasonCode: QUEUE_TASK_RECOVERY_LOG_REASON_IDS.VISIBILITY_RECOVERY_FAILED,
            });
            return 0;
        }
    }

    async gracefulShutdown() {
        this.setRunning(false);
        try {
            const result = await this.db.query(
                `UPDATE task_queue
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = $1
                 WHERE status = 'processing'
                 RETURNING id`,
                [QUEUE_TASK_FAILURE_REASON_IDS.GRACEFUL_SHUTDOWN_RECOVERED]
            );
            if (result.rowCount > 0) {
                this.logger.info('Graceful shutdown: reset in-flight tasks to pending', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id),
                });
            }
        } catch {
            this.logger.error('Graceful shutdown: failed to reset in-flight tasks', {
                reasonCode: QUEUE_TASK_RECOVERY_LOG_REASON_IDS.GRACEFUL_SHUTDOWN_RECOVERY_FAILED,
            });
        }
    }

    async startWorker() {
        if (this.getState().running) {
            this.logger.warn('Worker already running');
            return;
        }

        await this.resetStaleProcessingTasks();

        this.backgroundDrainIfBloated().catch(() => {
            this.logger.warn('Background task_queue drain failed', {
                reasonCode: QUEUE_TASK_RECOVERY_LOG_REASON_IDS.BACKGROUND_DRAIN_FAILED,
            });
        });

        this.setRunning(true);
        this.logger.info('Queue worker started');

        while (this.getState().running) {
            const now = Date.now();
            this.maybeRunVisibilityRecovery(now);
            this.updateConcurrencyStallState(now);

            try {
                const dispatched = await this.maybeDispatchTask();
                if (dispatched) {
                    continue;
                }
            } catch {
                this.logger.error('Worker loop error', {
                    reasonCode: QUEUE_TASK_RECOVERY_LOG_REASON_IDS.WORKER_LOOP_FAILED,
                });
            }

            await this.wait(this.pollIntervalMs);
        }

        this.logger.info('Queue worker stopped');
    }
}
