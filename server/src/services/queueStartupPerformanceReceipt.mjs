/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const QUEUE_STARTUP_PERFORMANCE_RECEIPT_VERSION = 'queue.startup_performance_receipt.v1';

export const QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS = Object.freeze({
    QUEUE_WORKER_HEALTH: 'queue_worker_health',
    QUEUE_REFILL_CANDIDATES: 'queue_refill_candidates',
});

export const QUEUE_STARTUP_BUFFER_BUCKET = 'not_sampled';

const OPERATION_IDS = new Set(Object.values(QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS));

function nonNegativeInteger(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function durationBucket(durationMs) {
    const duration = Number(durationMs);
    if (!Number.isFinite(duration) || duration < 0) return 'unavailable';
    if (duration < 5) return 'under_5ms';
    if (duration < 25) return '5_to_24ms';
    if (duration < 100) return '25_to_99ms';
    if (duration < 500) return '100_to_499ms';
    return '500ms_or_more';
}

function countBucket(value, notApplicable = false) {
    if (notApplicable) return 'not_applicable';
    const count = nonNegativeInteger(value);
    if (count === 0) return 'zero';
    if (count < 100) return '1_to_99';
    if (count < 1000) return '100_to_999';
    if (count < 5000) return '1000_to_4999';
    return '5000_or_more';
}

/**
 * Converts an execution into a fixed aggregate receipt. It deliberately omits
 * SQL, row IDs, media fields, provider/configuration values, and error text.
 */
export function buildQueueStartupPerformanceReceipt({
    operationId,
    durationMs,
    scannedIdCount = null,
    candidateCount = null,
} = {}) {
    if (!OPERATION_IDS.has(operationId)) {
        throw new TypeError('A supported queue startup operation is required.');
    }

    const isHealthRead = operationId === QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS.QUEUE_WORKER_HEALTH;

    return Object.freeze({
        version: QUEUE_STARTUP_PERFORMANCE_RECEIPT_VERSION,
        operationId,
        durationBucket: durationBucket(durationMs),
        scannedIdBucket: countBucket(scannedIdCount, isHealthRead),
        candidateCountBucket: countBucket(candidateCount, isHealthRead),
        bufferBucket: QUEUE_STARTUP_BUFFER_BUCKET,
        observationCount: 1,
    });
}

export function elapsedMilliseconds(startedAt, finishedAt = process.hrtime.bigint()) {
    if (typeof startedAt !== 'bigint' || typeof finishedAt !== 'bigint' || finishedAt < startedAt) {
        return null;
    }
    return Number(finishedAt - startedAt) / 1e6;
}

/**
 * Keeps optional receipt collection outside the success path of the observed
 * read. An observability defect must not turn a healthy queue read into a
 * failed health probe or refill cycle.
 */
export function recordQueueStartupPerformanceObservation(recorder, observation) {
    if (typeof recorder?.record !== 'function') return null;
    try {
        return recorder.record(observation);
    } catch (_) {
        return null;
    }
}
