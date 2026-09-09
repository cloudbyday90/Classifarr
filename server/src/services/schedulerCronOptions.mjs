/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/**
 * Scheduler tasks run one at a time in each process. node-cron handles
 * recurring fires; this guard also covers delayed-start tasks and direct
 * invocations that share the same task name.
 */
export function createSchedulerCronOptions(scheduleOptions = {}) {
    if (scheduleOptions === null || typeof scheduleOptions !== 'object' || Array.isArray(scheduleOptions)) {
        throw new TypeError('Scheduler options must be an object.');
    }
    if (scheduleOptions.noOverlap === false) {
        throw new TypeError('Scheduled task overlap cannot be enabled.');
    }

    return Object.freeze({
        ...scheduleOptions,
        noOverlap: true,
    });
}
