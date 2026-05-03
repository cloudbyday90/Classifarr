/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { DB_ADVISORY_LOCKS } = require('../config/database');

const DEFAULT_VISIBILITY_TIMEOUT_MINUTES = parseInt(process.env.TASK_VISIBILITY_TIMEOUT_MINUTES || '10', 10);

class QueueWorkerLoopService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
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
        this.backgroundDrainIfBloated = deps.backgroundDrainIfBloated || (async () => {});
        this.hasClassificationDispatchBlocker = deps.hasClassificationDispatchBlocker || (async () => ({
            hasProcessingClassification: false,
            lookupFailed: false,
        }));
        this.dequeue = deps.dequeue || (async () => null);
        this.checkAIAvailability = deps.checkAIAvailability || (async () => true);
        this.processTask = deps.processTask || (async () => {});
        this.pollIntervalMs = deps.pollIntervalMs || 1000;
        this.maxConcurrent = deps.maxConcurrent || 5;
        this.visibilityRecoveryIntervalMs = deps.visibilityRecoveryIntervalMs || 60_000;
        this.stallWarnIntervalMs = deps.stallWarnIntervalMs || 30_000;
        this.aiAvailabilityProbeIntervalMs = deps.aiAvailabilityProbeIntervalMs || 30_000;
        this.wait = deps.wait || ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
        this.yieldToEventLoop = deps.yieldToEventLoop || (() => new Promise(resolve => setImmediate(resolve)));
    }

    async requeueTask(taskId) {
        await this.db.query(
            `UPDATE task_queue SET status = 'pending', started_at = NULL, visible_at = NULL WHERE id = $1`,
            [taskId]
        );
    }

    maybeRunVisibilityRecovery(now) {
        const state = this.getState();
        if (now - state.lastRecoveryCheck < this.visibilityRecoveryIntervalMs) {
            return;
        }

        this.setLastRecoveryCheck(now);
        this.recoverExpiredVisibilityTasks().catch(err => {
            this.logger.error('Visibility timeout recovery failed', { error: err.message });
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

    async maybeDispatchTask() {
        const state = this.getState();
        if (state.processing >= this.maxConcurrent) {
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

        const task = await this.dequeue({
            excludeClassification
        });

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

        this.incrementProcessing();
        this.processTask(task).finally(() => {
            this.decrementProcessing();
        });

        await this.yieldToEventLoop();
        return true;
    }

    /**
     * Reset any tasks stuck in 'processing' state from a previous run.
     * Uses a transaction-level advisory lock to prevent two containers from
     * racing during a rolling restart (K8s maxSurge > 0). If another container
     * already holds the lock it is already doing the reset — skip silently.
     * MUST use pool.connect() directly — not timedQuery — so the advisory lock
     * has transaction scope and is released when the client is released.
     */
    async resetStaleProcessingTasks() {
        let client;
        try {
            client = await this.db.pool.connect();
            await client.query('BEGIN');
            const lockResult = await client.query(
                'SELECT pg_try_advisory_xact_lock($1) AS acquired',
                [DB_ADVISORY_LOCKS.STARTUP_RESET]
            );
            if (!lockResult.rows[0].acquired) {
                this.logger.info('resetStaleProcessingTasks: skipped (another container holds startup lock)');
                await client.query('ROLLBACK');
                return 0;
            }
            const result = await client.query(
                // Age guard: only reset tasks that have been processing for more than
                // visibilityTimeoutMinutes. Tasks started very recently (e.g. during a
                // rolling restart overlap) are left alone and will self-recover via the
                // visibility timeout in the worker loop.
                `UPDATE task_queue 
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = 'Reset on startup - previous worker crashed'
                 WHERE status = 'processing'
                   AND (started_at IS NULL OR started_at < NOW() - INTERVAL '${this.visibilityTimeoutMinutes} minutes')
                 RETURNING id`
            );
            await client.query('COMMIT');
            if (result.rowCount > 0) {
                this.logger.warn('Reset stale processing tasks on startup', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id)
                });
            }
            return result.rowCount;
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {}); // swallow-error: ROLLBACK is best-effort in error handler; error is logged below
            this.logger.error('Failed to reset stale tasks', { error: error.message });
            return 0;
        } finally {
            if (client) client.release();
        }
    }

    /**
     * Periodic recovery: re-queue any tasks whose visibility window has expired.
     * Called from the worker loop every visibilityRecoveryIntervalMs.
     * Provides crash/OOM recovery without requiring a process restart.
     *
     * @returns {Promise<number>} number of tasks recovered
     */
    async recoverExpiredVisibilityTasks() {
        try {
            const result = await this.db.query(
                `UPDATE task_queue
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = 'Recovered: visibility timeout expired'
                 WHERE status = 'processing'
                   AND visible_at IS NOT NULL
                   AND visible_at <= NOW()
                 RETURNING id`
            );
            if (result.rowCount > 0) {
                // Compensate the in-memory counter so dequeue() can resume immediately.
                // Without this, processing stays at MAX_CONCURRENT even though DB rows
                // have been reset to 'pending', and no new tasks are ever dequeued.
                for (let i = 0; i < result.rowCount; i++) this.decrementProcessing();
                this.logger.warn('Recovered tasks with expired visibility timeout; decremented processing counter', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id),
                    processingAfter: this.getState().processing,
                });
            }
            return result.rowCount;
        } catch (error) {
            this.logger.error('Failed to recover expired visibility tasks', { error: error.message });
            return 0;
        }
    }

    /**
     * Graceful shutdown: stop the worker loop and reset any in-flight tasks back
     * to 'pending' so they are retried on next startup without a stale-task WARN.
     */
    async gracefulShutdown() {
        this.setRunning(false);
        try {
            const result = await this.db.query(
                `UPDATE task_queue
                 SET status = 'pending', started_at = NULL, visible_at = NULL,
                     error_message = 'Reset by graceful shutdown'
                 WHERE status = 'processing'
                 RETURNING id`
            );
            if (result.rowCount > 0) {
                this.logger.info('Graceful shutdown: reset in-flight tasks to pending', {
                    count: result.rowCount,
                    taskIds: result.rows.map(r => r.id),
                });
            }
        } catch (err) {
            this.logger.error('Graceful shutdown: failed to reset in-flight tasks', { error: err.message });
        }
    }

    async startWorker() {
        if (this.getState().running) {
            this.logger.warn('Worker already running');
            return;
        }

        await this.resetStaleProcessingTasks();

        this.backgroundDrainIfBloated().catch(err => {
            this.logger.warn('Background task_queue drain failed', { error: err.message });
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
            } catch (error) {
                this.logger.error('Worker loop error', { error: error.message });
            }

            await this.wait(this.pollIntervalMs);
        }

        this.logger.info('Queue worker stopped');
    }
}

module.exports = { QueueWorkerLoopService };
