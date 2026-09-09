/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const EVENT_LOOP_DELAY_RECEIPT_VERSION = 'event_loop.delay_receipt.v1';
export const EVENT_LOOP_DELAY_RESOLUTION_MS = 20;

function delayBucket(p99DelayNanoseconds) {
    const delayMs = Number(p99DelayNanoseconds) / 1e6;
    if (!Number.isFinite(delayMs) || delayMs < 0) return 'unavailable';
    if (delayMs < 25) return 'under_25ms';
    if (delayMs < 50) return '25_to_49ms';
    if (delayMs < 100) return '50_to_99ms';
    if (delayMs < 500) return '100_to_499ms';
    return '500ms_or_more';
}

function hasSamples(sampleCount) {
    const count = Number(sampleCount);
    return Number.isSafeInteger(count) && count > 0;
}

/**
 * Reduces a local event-loop histogram to one fixed aggregate. The raw value,
 * sample count, process identity, configuration, task, media, library,
 * provider, policy, AI, decision, error, and routing data are never retained.
 */
export function buildEventLoopDelayReceipt({
    p99DelayNanoseconds,
    sampleCount,
} = {}) {
    return Object.freeze({
        version: EVENT_LOOP_DELAY_RECEIPT_VERSION,
        p99DelayBucket: hasSamples(sampleCount)
            ? delayBucket(p99DelayNanoseconds)
            : 'unavailable',
        observationCount: 1,
    });
}
