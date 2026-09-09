/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { monitorEventLoopDelay } from 'node:perf_hooks';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
    buildEventLoopDelayReceipt,
    EVENT_LOOP_DELAY_RESOLUTION_MS,
} from './eventLoopDelayReceipt.mjs';
import { incrementEventLoopDelayReceipt } from './eventLoopDelayReceiptRepository.mjs';

const LOG_MODULE = 'EventLoopDelayObservation';
const OBSERVATION_UNAVAILABLE = 'Passive event-loop delay observation unavailable';
const PERSISTENCE_UNAVAILABLE = 'Event-loop delay receipt persistence failed';

function hasHistogramContract(histogram) {
    return histogram
        && typeof histogram.enable === 'function'
        && typeof histogram.disable === 'function'
        && typeof histogram.percentile === 'function';
}

/**
 * Samples process-local event-loop delay continuously, then persists only a
 * p99 bucket at the scheduled observation boundary. It has no caller input and
 * cannot change a task, policy, provider, classifier, or route.
 */
export function createEventLoopDelayObservationService({
    database = db,
    logger = createLogger(LOG_MODULE),
    createHistogram = monitorEventLoopDelay,
    buildReceipt = buildEventLoopDelayReceipt,
    incrementReceipt = incrementEventLoopDelayReceipt,
    resolutionMs = EVENT_LOOP_DELAY_RESOLUTION_MS,
} = {}) {
    if (!Number.isSafeInteger(resolutionMs) || resolutionMs <= 0) {
        throw new TypeError('Event-loop delay resolution must be a positive integer.');
    }
    if (typeof createHistogram !== 'function' || typeof buildReceipt !== 'function'
        || typeof incrementReceipt !== 'function') {
        throw new TypeError('Event-loop delay observation requires measurement and persistence functions.');
    }

    let histogram = null;
    let started = false;

    function start() {
        if (started) return false;
        const candidate = createHistogram({ resolution: resolutionMs });
        if (!hasHistogramContract(candidate)) {
            throw new TypeError('Event-loop delay monitor does not implement the required histogram contract.');
        }
        candidate.enable();
        histogram = candidate;
        started = true;
        return true;
    }

    function stop() {
        if (!started || !histogram) return false;
        histogram.disable();
        histogram = null;
        started = false;
        return true;
    }

    function snapshot() {
        if (!started || !histogram) return null;
        try {
            const receipt = buildReceipt({
                p99DelayNanoseconds: histogram.percentile(99),
                sampleCount: histogram.count,
            });
            histogram.reset?.();
            return receipt;
        } catch (_) {
            logger.warn(OBSERVATION_UNAVAILABLE, {
                reasonCode: 'event_loop_delay_histogram_unavailable',
            }, { skipDbPersist: true });
            return null;
        }
    }

    async function observe() {
        const receipt = snapshot();
        if (!receipt) return null;
        try {
            await incrementReceipt(database, receipt);
            return receipt;
        } catch (_) {
            logger.warn(PERSISTENCE_UNAVAILABLE, {
                reasonCode: 'event_loop_delay_receipt_persistence_failed',
            }, { skipDbPersist: true });
            return null;
        }
    }

    return Object.freeze({
        observe,
        snapshot,
        start,
        stop,
    });
}

export const eventLoopDelayObservationService = createEventLoopDelayObservationService();
