/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { buildQueueStartupPerformanceReceipt } from './queueStartupPerformanceReceipt.mjs';
import { incrementQueueStartupPerformanceReceipt } from './queueStartupPerformanceReceiptRepository.mjs';

export const QUEUE_STARTUP_PERFORMANCE_RECEIPT_FLUSH_MS = 60_000;
const LOG_MODULE = 'QueueStartupPerformanceReceipt';
const WRITE_FAILURE_MESSAGE = 'Queue startup performance receipt persistence failed';

function receiptKey(receipt) {
    return [
        receipt.operationId,
        receipt.version,
        receipt.durationBucket,
        receipt.scannedIdBucket,
        receipt.candidateCountBucket,
        receipt.bufferBucket,
    ].join('|');
}

/**
 * Coalesces fixed aggregate receipts before persisting. Queue work and health
 * responses never await this optional observability write.
 */
export function createQueueStartupPerformanceReceiptService({
    database = db,
    logger = createLogger(LOG_MODULE),
    buildReceipt = buildQueueStartupPerformanceReceipt,
    incrementReceipt = incrementQueueStartupPerformanceReceipt,
    flushDelayMs = QUEUE_STARTUP_PERFORMANCE_RECEIPT_FLUSH_MS,
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
                    reasonCode: 'queue_startup_performance_receipt_persistence_failed',
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

export const queueStartupPerformanceReceiptService = createQueueStartupPerformanceReceiptService();
