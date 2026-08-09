/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export const TASK_QUEUE_CLEANUP_ORIGINS = Object.freeze({
    LEGACY: 'legacy',
    WORKER_STARTUP: 'worker_startup',
    STARTUP_DELAYED: 'startup_delayed',
    CRON: 'cron',
});

const TASK_QUEUE_CLEANUP_ORIGIN_VALUES = new Set(Object.values(TASK_QUEUE_CLEANUP_ORIGINS));

export function assertTaskQueueCleanupOrigin(cleanupOrigin) {
    if (!TASK_QUEUE_CLEANUP_ORIGIN_VALUES.has(cleanupOrigin)) {
        throw new TypeError(`Unsupported task queue cleanup origin: ${cleanupOrigin}`);
    }

    return cleanupOrigin;
}

export function getBackgroundDrainLogDescriptor(trigger) {
    if (trigger === 'age') {
        return {
            level: 'info',
            message: 'task_queue retention backlog detected at worker startup; running background drain',
        };
    }

    return {
        level: 'warn',
        message: 'task_queue capacity pressure detected at worker startup; running background drain',
    };
}

export function createCleanupSkipResult(cleanupOrigin, reason) {
    return {
        status: 'skipped',
        cleanupOrigin,
        reason,
    };
}
