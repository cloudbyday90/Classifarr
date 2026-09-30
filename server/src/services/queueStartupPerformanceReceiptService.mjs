/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { AsyncResource } from 'node:async_hooks';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { buildQueueStartupPerformanceReceipt } from './queueStartupPerformanceReceipt.mjs';
import { incrementQueueStartupPerformanceReceipt } from './queueStartupPerformanceReceiptRepository.mjs';
import { warnQueueStartupPerformanceReceiptFailure } from './queueStartupPerformanceReceiptDiagnostics.mjs';

export const QUEUE_STARTUP_PERFORMANCE_RECEIPT_FLUSH_MS = 60_000;
const LOG_MODULE = 'QueueStartupPerformanceReceipt';

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
 * Construct during bootstrap, outside request/ingestion lock scopes. Only the
 * fixed receipt writer can use the captured context; no SQL/callback escape hatch.
 */
export function createQueueStartupPerformanceReceiptService({
    database = db,
    logger = createLogger(LOG_MODULE),
    incrementReceipt = incrementQueueStartupPerformanceReceipt,
    flushDelayMs = QUEUE_STARTUP_PERFORMANCE_RECEIPT_FLUSH_MS,
} = {}) {
    const context = new AsyncResource('QueueStartupPerformanceReceipt');
    let pending = new Map();
    let timer = null;
    let inFlight = null;
    let stopped = false;

    function clearTimer() {
        if (timer) clearTimeout(timer);
        timer = null;
    }

    function scheduleFlush() {
        if (stopped || timer || inFlight || pending.size === 0) return;
        // The timer itself must not retain the calling request/lock context.
        context.runInAsyncScope(() => {
            timer = setTimeout(() => { void flush(); }, flushDelayMs);
            timer.unref?.();
        });
    }

    function record(observation = {}) {
        if (stopped) return null;
        const receipt = buildQueueStartupPerformanceReceipt(observation);
        const key = receiptKey(receipt);
        const existing = pending.get(key);
        pending.set(key, {
            ...receipt,
            observationCount: Math.min((existing?.observationCount || 0) + 1, Number.MAX_SAFE_INTEGER),
        });
        scheduleFlush();
        return receipt;
    }

    async function persistBatch(batch) {
        for (const receipt of batch) {
            if (stopped) break;
            try {
                await incrementReceipt(database, receipt);
            } catch (error) {
                warnQueueStartupPerformanceReceiptFailure(logger, error);
                // Best effort: ambiguous writes cannot safely be replayed. Drop
                // the remainder too, avoiding a burst of failures against the DB.
                break;
            }
        }
        return batch;
    }

    function flush() {
        if (inFlight) return inFlight;
        if (stopped) return Promise.resolve([]);
        clearTimer();
        const batch = [...pending.values()];
        pending = new Map();
        // Publish single-flight ownership before invoking the writer. Records
        // arriving during this batch wait for a new delayed batch, never a loop.
        inFlight = context.runInAsyncScope(() => Promise.resolve()
            .then(() => persistBatch(batch))
            .finally(() => {
                inFlight = null;
                if (stopped) context.emitDestroy();
                else scheduleFlush();
            }));
        return inFlight;
    }

    function stop() {
        if (stopped) return;
        stopped = true;
        clearTimer();
        pending.clear();
        // Do not delay application shutdown for optional metrics. An already
        // issued query may settle under normal DB timeouts; no next query starts.
        if (!inFlight) context.emitDestroy();
    }

    return Object.freeze({
        record,
        flush,
        stop,
        pendingCount: () => pending.size,
    });
}

// Imported by normalRuntime at bootstrap, before any queue/request-owned work.
export const queueStartupPerformanceReceiptService = createQueueStartupPerformanceReceiptService();
