/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

class QueueWorkerLoopService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.getState = deps.getState || (() => ({
            running: false,
            processing: 0,
            lastRecoveryCheck: 0,
            fullConcurrencyStartedAt: 0,
        }));
        this.setRunning = deps.setRunning || (() => {});
        this.incrementProcessing = deps.incrementProcessing || (() => {});
        this.decrementProcessing = deps.decrementProcessing || (() => {});
        this.setLastRecoveryCheck = deps.setLastRecoveryCheck || (() => {});
        this.setFullConcurrencyStartedAt = deps.setFullConcurrencyStartedAt || (() => {});
        this.resetStaleProcessingTasks = deps.resetStaleProcessingTasks || (async () => 0);
        this.backgroundDrainIfBloated = deps.backgroundDrainIfBloated || (async () => {});
        this.hasClassificationDispatchBlocker = deps.hasClassificationDispatchBlocker || (async () => ({
            hasProcessingClassification: false,
            lookupFailed: false,
        }));
        this.dequeue = deps.dequeue || (async () => null);
        this.checkAIAvailability = deps.checkAIAvailability || (async () => true);
        this.processTask = deps.processTask || (async () => {});
        this.recoverExpiredVisibilityTasks = deps.recoverExpiredVisibilityTasks || (async () => 0);
        this.pollIntervalMs = deps.pollIntervalMs || 1000;
        this.maxConcurrent = deps.maxConcurrent || 5;
        this.visibilityRecoveryIntervalMs = deps.visibilityRecoveryIntervalMs || 60_000;
        this.stallWarnIntervalMs = deps.stallWarnIntervalMs || 30_000;
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
        const task = await this.dequeue({
            excludeClassification: blockers.lookupFailed || blockers.hasProcessingClassification
        });

        if (!task) {
            return false;
        }

        if (task.task_type === 'classification') {
            const aiReady = await this.checkAIAvailability();
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
