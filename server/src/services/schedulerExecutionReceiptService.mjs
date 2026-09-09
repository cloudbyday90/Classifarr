/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { buildSchedulerExecutionReceipt } from './schedulerExecutionReceipt.mjs';
import { incrementSchedulerExecutionReceipt } from './schedulerExecutionReceiptRepository.mjs';

export const SCHEDULER_EXECUTION_RECEIPT_FLUSH_MS = 60_000;
const LOG_MODULE = 'SchedulerExecutionReceipt';
const WRITE_FAILURE_MESSAGE = 'Scheduler execution receipt persistence failed';

function receiptKey(receipt) {
    return [
        receipt.taskClass,
        receipt.outcomeId,
        receipt.version,
        receipt.durationBucket,
    ].join('|');
}

/**
 * Coalesces fixed aggregate scheduler receipts. A task never waits for this
 * optional write, and storage failures do not alter task execution.
 */
export function createSchedulerExecutionReceiptService({
    database = db,
    logger = createLogger(LOG_MODULE),
    buildReceipt = buildSchedulerExecutionReceipt,
    incrementReceipt = incrementSchedulerExecutionReceipt,
    flushDelayMs = SCHEDULER_EXECUTION_RECEIPT_FLUSH_MS,
} = {}) {
    let pending = new Map();
    let timer = null;

    function scheduleFlush() {
        if (timer) return;
        timer = setTimeout(() => {
            void flush();
        }, flushDelayMs);
        timer.unref?.();
    }

    function record(observation = {}) {
        const receipt = buildReceipt(observation);
        const key = receiptKey(receipt);
        const existing = pending.get(key);
        pending.set(key, {
            ...receipt,
            observationCount: (existing?.observationCount || 0) + 1,
        });
        scheduleFlush();
        return receipt;
    }

    async function flush() {
        if (timer) clearTimeout(timer);
        timer = null;
        const batch = [...pending.values()];
        pending = new Map();

        for (const receipt of batch) {
            try {
                await incrementReceipt(database, receipt);
            } catch (_) {
                logger.warn(WRITE_FAILURE_MESSAGE, {
                    reasonCode: 'scheduler_execution_receipt_persistence_failed',
                }, { skipDbPersist: true });
            }
        }
        return batch;
    }

    return Object.freeze({
        record,
        flush,
        pendingCount: () => pending.size,
    });
}

export const schedulerExecutionReceiptService = createSchedulerExecutionReceiptService();
