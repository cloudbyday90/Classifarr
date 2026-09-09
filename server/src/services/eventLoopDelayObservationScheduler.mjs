/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { createLogger } from '../utils/logger.mjs';
import { eventLoopDelayObservationService } from './eventLoopDelayObservationService.mjs';
import {
    EVENT_LOOP_DELAY_OBSERVATION_CRON,
    EVENT_LOOP_DELAY_OBSERVATION_INITIAL_DELAY_MS,
    EVENT_LOOP_DELAY_OBSERVATION_TASK_NAME,
} from './eventLoopDelayObservationSchedule.mjs';

const logger = createLogger('EventLoopDelayObservation');

/**
 * Begins local histogram collection before registering a fixed recurring
 * observation. Each replica contributes only an anonymous aggregate bucket;
 * no advisory lock suppresses another replica's process-health evidence.
 */
export function registerEventLoopDelayObservationSchedule(scheduler, {
    observer = eventLoopDelayObservationService,
    log = logger,
} = {}) {
    if (!scheduler || typeof scheduler.schedule !== 'function' || typeof scheduler.scheduleInitial !== 'function') {
        throw new TypeError('Event-loop delay observation requires a scheduler.');
    }
    if (!observer || typeof observer.start !== 'function' || typeof observer.observe !== 'function') {
        throw new TypeError('Event-loop delay observation requires an observer.');
    }

    try {
        observer.start();
    } catch (_) {
        log.warn('Passive event-loop delay monitoring unavailable');
        return false;
    }

    const observe = () => observer.observe();
    scheduler.schedule(
        EVENT_LOOP_DELAY_OBSERVATION_TASK_NAME,
        EVENT_LOOP_DELAY_OBSERVATION_CRON,
        observe,
        null,
        { noOverlap: true },
    );
    scheduler.scheduleInitial(
        EVENT_LOOP_DELAY_OBSERVATION_TASK_NAME,
        EVENT_LOOP_DELAY_OBSERVATION_INITIAL_DELAY_MS,
        observe,
    );
    return true;
}

/** Stops local sampling when the scheduler is reset or the process exits. */
export function stopEventLoopDelayObservationSchedule({
    observer = eventLoopDelayObservationService,
    log = logger,
} = {}) {
    if (!observer || typeof observer.stop !== 'function') return false;
    try {
        return observer.stop() === true;
    } catch (_) {
        log.warn('Passive event-loop delay monitoring shutdown unavailable');
        return false;
    }
}
