/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import {
    elapsedSchedulerMilliseconds,
    recordSchedulerExecutionObservation,
    SCHEDULER_EXECUTION_OUTCOME_IDS,
} from './schedulerExecutionReceipt.mjs';

/**
 * Coordinates in-process task execution and records only optional fixed
 * aggregates. Database advisory locks remain the cross-process boundary for
 * tasks that require ownership across replicas.
 */
export function createSchedulerTaskExecutionRunner({
    withSessionAdvisoryLock,
    logger,
    receiptRecorder = null,
} = {}) {
    if (typeof withSessionAdvisoryLock !== 'function') {
        throw new TypeError('Scheduler task execution requires an advisory-lock runner.');
    }
    if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function'
        || typeof logger.debug !== 'function') {
        throw new TypeError('Scheduler task execution requires an info, debug, and error logger.');
    }

    const runningTaskNames = new Set();

    function record(taskName, outcomeId, durationMs = null) {
        return recordSchedulerExecutionObservation(receiptRecorder, {
            taskName,
            outcomeId,
            durationMs,
        });
    }

    async function run({ name, handler, lockKey = null } = {}) {
        if (typeof name !== 'string' || name.length === 0 || typeof handler !== 'function') {
            throw new TypeError('A scheduler task name and handler are required.');
        }

        if (runningTaskNames.has(name)) {
            logger.debug(`Scheduled task ${name} skipped — already running in this process`);
            record(name, SCHEDULER_EXECUTION_OUTCOME_IDS.IN_PROCESS_OVERLAP);
            return false;
        }

        const startedAt = process.hrtime.bigint();
        runningTaskNames.add(name);
        logger.info(`Starting scheduled task: ${name}`);

        try {
            if (lockKey !== null) {
                const acquired = await withSessionAdvisoryLock(lockKey, handler);
                if (!acquired) {
                    logger.debug(`Scheduled task ${name} skipped — advisory lock held by another process`, { lockKey });
                    record(name, SCHEDULER_EXECUTION_OUTCOME_IDS.ADVISORY_LOCK_HELD);
                    return false;
                }
            } else {
                await handler();
            }
            logger.info(`Completed scheduled task: ${name}`);
            record(name, SCHEDULER_EXECUTION_OUTCOME_IDS.COMPLETED,
                elapsedSchedulerMilliseconds(startedAt));
            return true;
        } catch (error) {
            logger.error(`Failed scheduled task: ${name}`, { error: error.message });
            record(name, SCHEDULER_EXECUTION_OUTCOME_IDS.FAILED,
                elapsedSchedulerMilliseconds(startedAt));
            return false;
        } finally {
            runningTaskNames.delete(name);
        }
    }

    function observeCronOverlap(task, taskName) {
        if (typeof task?.on !== 'function') return;
        try {
            task.on('execution:overlap', () => {
                logger.debug(`Scheduled task ${taskName} skipped — previous run still active`);
                record(taskName, SCHEDULER_EXECUTION_OUTCOME_IDS.CRON_OVERLAP);
            });
        } catch (_) {
            // Cron-event observation is optional and must not prevent scheduling.
        }
    }

    function reset() {
        runningTaskNames.clear();
    }

    return Object.freeze({
        observeCronOverlap,
        reset,
        run,
    });
}
